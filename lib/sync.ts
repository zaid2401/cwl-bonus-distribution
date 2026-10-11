import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { getDb, schema as s, type DB } from "./db";
import {
  coc,
  CocError,
  enc,
  pool,
  type ApiLeagueGroup,
  type ApiPlayer,
  type ApiWar,
  type ApiMember,
} from "./coc";
import { cwlSeasonId, prevMonth, seasonLabel } from "./util";

export interface SyncResult {
  clanTag: string;
  ok: boolean;
  message: string;
}

async function ensureSeason(db: DB, id: string) {
  await db
    .insert(s.seasons)
    .values({
      id,
      label: seasonLabel(id),
      sortKey: `${id}-01`,
      donationSeason: prevMonth(id),
      hasCwlData: true,
    })
    .onConflictDoUpdate({ target: s.seasons.id, set: { hasCwlData: true } });
  const [row] = await db.select().from(s.seasons).where(eq(s.seasons.id, id));
  return row;
}

async function saveWar(db: DB, seasonId: string, round: number, warTag: string, war: ApiWar) {
  const posOf = new Map<string, number>();
  for (const side of [war.clan, war.opponent])
    for (const m of side.members ?? []) posOf.set(m.tag, m.mapPosition ?? 0);

  await db
    .insert(s.cwlWars)
    .values({
      warTag,
      seasonId,
      round,
      clanTag: war.clan.tag,
      clanName: war.clan.name ?? "",
      opponentTag: war.opponent.tag,
      opponentName: war.opponent.name ?? "",
      state: war.state,
      teamSize: war.teamSize ?? 0,
      clanStars: war.clan.stars ?? 0,
      clanDestruction: war.clan.destructionPercentage ?? 0,
      opponentStars: war.opponent.stars ?? 0,
      opponentDestruction: war.opponent.destructionPercentage ?? 0,
    })
    .onConflictDoUpdate({
      target: s.cwlWars.warTag,
      set: {
        clanName: war.clan.name ?? "",
        opponentName: war.opponent.name ?? "",
        state: war.state,
        teamSize: war.teamSize ?? 0,
        clanStars: war.clan.stars ?? 0,
        clanDestruction: war.clan.destructionPercentage ?? 0,
        opponentStars: war.opponent.stars ?? 0,
        opponentDestruction: war.opponent.destructionPercentage ?? 0,
        fetchedAt: new Date(),
      },
    });

  await db.delete(s.cwlWarMembers).where(eq(s.cwlWarMembers.warTag, warTag));
  await db.delete(s.cwlAttacks).where(eq(s.cwlAttacks.warTag, warTag));

  const members: (typeof s.cwlWarMembers.$inferInsert)[] = [];
  const attacks: (typeof s.cwlAttacks.$inferInsert)[] = [];
  for (const side of [war.clan, war.opponent]) {
    for (const m of side.members ?? []) {
      members.push({
        warTag,
        clanTag: side.tag,
        playerTag: m.tag,
        name: m.name,
        townhall: m.townhallLevel ?? m.townHallLevel ?? null,
        mapPosition: m.mapPosition ?? 0,
      });
      for (const a of m.attacks ?? []) {
        attacks.push({
          warTag,
          round,
          clanTag: side.tag,
          attackerTag: a.attackerTag,
          defenderTag: a.defenderTag,
          attackerPosition: m.mapPosition ?? 0,
          defenderPosition: posOf.get(a.defenderTag) ?? 0,
          stars: a.stars,
          destruction: a.destructionPercentage,
          order: a.order,
        });
      }
    }
  }
  if (members.length) await db.insert(s.cwlWarMembers).values(members).onConflictDoNothing();
  if (attacks.length) await db.insert(s.cwlAttacks).values(attacks).onConflictDoNothing();
}

// Where this clan's CWL players are right now. It has to be one call per player: the CWL
// clans stand empty between leagues and everyone sits in their own home clan, which this app
// does not track, so a clan's member list answers nothing. Roster comes from the newest
// season, which is the one the boards show.
async function syncCurrentClans(db: DB, clanTag: string): Promise<number> {
  const [latest] = await db.select().from(s.seasons).orderBy(desc(s.seasons.sortKey)).limit(1);
  if (!latest) return 0;
  const roster = await db
    .select({ playerTag: s.cwlRoster.playerTag })
    .from(s.cwlRoster)
    .where(and(eq(s.cwlRoster.seasonId, latest.id), eq(s.cwlRoster.clanTag, clanTag)));
  if (!roster.length) return 0;

  const found = await pool(
    roster.map((r) => r.playerTag),
    8,
    async (tag) => {
      try {
        const p = await coc<ApiPlayer>(`/players/${enc(tag)}`);
        // A player in no clan at all reads the same as one we have never looked up. Rare
        // enough, and Left JPA is the tick that matters for a bonus.
        return {
          tag,
          name: p.name,
          currentClanTag: p.clan?.tag ?? null,
          currentClanName: p.clan?.name ?? null,
        };
      } catch {
        return null;
      }
    },
  );
  const rows = found.filter((r) => r !== null);
  for (let i = 0; i < rows.length; i += 200) {
    await db
      .insert(s.players)
      .values(rows.slice(i, i + 200))
      .onConflictDoUpdate({
        target: s.players.tag,
        set: {
          currentClanTag: sql`excluded.current_clan_tag`,
          currentClanName: sql`excluded.current_clan_name`,
        },
      });
  }
  return rows.length;
}

// Wars first, then where everyone is now — in that order, so a roster that just arrived is
// the one we look up, and so the lookup still happens on the paths that return early
// because there is no CWL on.
export async function syncCwlClan(clanTag: string): Promise<SyncResult> {
  const result = await syncCwlWars(clanTag);
  try {
    const n = await syncCurrentClans(await getDb(), clanTag);
    if (n) return { ...result, message: `${result.message} Clan checked for ${n} player(s).` };
  } catch {
    // Knowing where people are today is a nice-to-have, never a reason to fail a war sync.
  }
  return result;
}

async function syncCwlWars(clanTag: string): Promise<SyncResult> {
  const db = await getDb();
  let group: ApiLeagueGroup;
  try {
    group = await coc<ApiLeagueGroup>(`/clans/${enc(clanTag)}/currentwar/leaguegroup`);
  } catch (e) {
    if (e instanceof CocError && e.status === 404)
      return { clanTag, ok: false, message: "Not in CWL right now (no league group)." };
    return { clanTag, ok: false, message: (e as Error).message };
  }
  if (!group?.season)
    return { clanTag, ok: false, message: `League group state: ${group?.state ?? "unknown"}` };

  const season = await ensureSeason(db, cwlSeasonId(group.season));
  if (season.status === "finalized")
    return { clanTag, ok: true, message: `Season ${season.label} is finalized — skipped.` };

  const [known] = await db
    .select()
    .from(s.cwlClanSeasons)
    .where(and(eq(s.cwlClanSeasons.seasonId, season.id), eq(s.cwlClanSeasons.clanTag, clanTag)));
  if (known && !known.active) {
    return { clanTag, ok: true, message: `Not used in ${season.label}, skipped.` };
  }

  const ours = group.clans.find((c) => c.tag === clanTag);
  await db
    .insert(s.cwlClanSeasons)
    .values({ seasonId: season.id, clanTag, clanName: ours?.name ?? "" })
    .onConflictDoUpdate({
      target: [s.cwlClanSeasons.seasonId, s.cwlClanSeasons.clanTag],
      set: { clanName: ours?.name ?? sql`${s.cwlClanSeasons.clanName}` },
    });

  if (ours) {
    await db
      .delete(s.cwlRoster)
      .where(and(eq(s.cwlRoster.seasonId, season.id), eq(s.cwlRoster.clanTag, clanTag)));
    if (ours.members.length)
      await db.insert(s.cwlRoster).values(
        ours.members.map((m: ApiMember) => ({
          seasonId: season.id,
          clanTag,
          playerTag: m.tag,
          name: m.name,
          townhall: m.townHallLevel ?? m.townhallLevel ?? null,
        })),
      );
    await upsertPlayerNames(db, ours.members);
  }

  let fetched = 0;
  for (let r = 0; r < group.rounds.length; r++) {
    const round = r + 1;
    const tags = group.rounds[r].warTags.filter((t) => t && t !== "#0");
    if (!tags.length) continue;
    const known = await db.select().from(s.cwlWars).where(inArray(s.cwlWars.warTag, tags));
    const mine = known.find((w) => w.clanTag === clanTag || w.opponentTag === clanTag);
    if (mine?.state === "warEnded") continue;

    const toFetch = mine
      ? [mine.warTag]
      : tags.filter((t) => !known.some((k) => k.warTag === t && k.state === "warEnded"));
    const wars = await pool(toFetch, 4, async (t) => {
      try {
        return { t, war: await coc<ApiWar>(`/clanwarleagues/wars/${enc(t)}`) };
      } catch {
        return { t, war: null };
      }
    });
    for (const { t, war } of wars) {
      if (!war?.clan?.tag) continue;
      await saveWar(db, season.id, round, t, war);
      fetched++;
    }
  }

  const message = `Synced ${season.label}: ${fetched} war(s) fetched.`;
  await db
    .update(s.cwlClanSeasons)
    .set({ lastSyncedAt: new Date(), syncMessage: message })
    .where(and(eq(s.cwlClanSeasons.seasonId, season.id), eq(s.cwlClanSeasons.clanTag, clanTag)));
  return { clanTag, ok: true, message };
}

export async function syncAllCwl(): Promise<SyncResult[]> {
  const db = await getDb();
  const list = await db.select().from(s.clans);
  return pool(list, 3, (c) => syncCwlClan(c.tag));
}

async function upsertPlayerNames(db: DB, members: { tag: string; name: string }[]) {
  if (!members.length) return;
  await db
    .insert(s.players)
    .values(members.map((m) => ({ tag: m.tag, name: m.name })))
    .onConflictDoUpdate({ target: s.players.tag, set: { name: sql`excluded.name` } });
}

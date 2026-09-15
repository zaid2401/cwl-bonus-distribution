import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import { getDb, schema as s, type DB } from "./db";
import { coc, CocError, enc, pool, type ApiLeagueGroup, type ApiWar, type ApiMember } from "./coc";
import { gameSeasonAt, prevMonth, seasonLabel } from "./util";

export interface SyncResult {
  clanTag: string;
  ok: boolean;
  message: string;
}

async function ensureSeason(db: DB, id: string) {
  await db
    .insert(s.seasons)
    .values({ id, label: seasonLabel(id), sortKey: `${id}-01`, donationSeason: prevMonth(id), hasCwlData: true })
    .onConflictDoUpdate({ target: s.seasons.id, set: { hasCwlData: true } });
  const [row] = await db.select().from(s.seasons).where(eq(s.seasons.id, id));
  return row;
}

async function saveWar(db: DB, seasonId: string, round: number, warTag: string, war: ApiWar) {
  const posOf = new Map<string, number>();
  for (const side of [war.clan, war.opponent]) for (const m of side.members ?? []) posOf.set(m.tag, m.mapPosition ?? 0);

  await db
    .insert(s.cwlWars)
    .values({
      warTag,
      seasonId,
      round,
      clanTag: war.clan.tag,
      opponentTag: war.opponent.tag,
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

/** Fetch the league group and all wars for one of your CWL clans. */
export async function syncCwlClan(clanTag: string): Promise<SyncResult> {
  const db = await getDb();
  let group: ApiLeagueGroup;
  try {
    group = await coc<ApiLeagueGroup>(`/clans/${enc(clanTag)}/currentwar/leaguegroup`);
  } catch (e) {
    if (e instanceof CocError && e.status === 404) return { clanTag, ok: false, message: "Not in CWL right now (no league group)." };
    return { clanTag, ok: false, message: (e as Error).message };
  }
  if (!group?.season) return { clanTag, ok: false, message: `League group state: ${group?.state ?? "unknown"}` };

  const season = await ensureSeason(db, group.season);
  if (season.status === "finalized") return { clanTag, ok: true, message: `Season ${season.label} is finalized — skipped.` };

  const ours = group.clans.find((c) => c.tag === clanTag);
  await db
    .insert(s.cwlClanSeasons)
    .values({ seasonId: season.id, clanTag, clanName: ours?.name ?? "" })
    .onConflictDoUpdate({
      target: [s.cwlClanSeasons.seasonId, s.cwlClanSeasons.clanTag],
      set: { clanName: ours?.name ?? sql`${s.cwlClanSeasons.clanName}` },
    });

  if (ours) {
    await db.delete(s.cwlRoster).where(and(eq(s.cwlRoster.seasonId, season.id), eq(s.cwlRoster.clanTag, clanTag)));
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

    const toFetch = mine ? [mine.warTag] : tags.filter((t) => !known.some((k) => k.warTag === t && k.state === "warEnded"));
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
  const list = await db.select().from(s.clans).where(ne(s.clans.cwlType, "none"));
  return pool(list, 3, (c) => syncCwlClan(c.tag));
}

async function upsertPlayerNames(db: DB, members: { tag: string; name: string }[]) {
  if (!members.length) return;
  await db
    .insert(s.players)
    .values(members.map((m) => ({ tag: m.tag, name: m.name })))
    .onConflictDoUpdate({ target: s.players.tag, set: { name: sql`excluded.name` } });
}

/** Save current-season donations for all alliance clans (keeps the highest value seen). */
export async function snapshotDonations(now = new Date()): Promise<SyncResult[]> {
  const db = await getDb();
  const season = gameSeasonAt(now);
  const list = await db.select().from(s.clans).where(eq(s.clans.isAlliance, true));
  return pool(list, 4, async (c) => {
    try {
      const res = await coc<{ items: ApiMember[] }>(`/clans/${enc(c.tag)}/members?limit=50`);
      const items = res.items ?? [];
      await upsertPlayerNames(db, items);
      if (items.length)
        await db
          .insert(s.donations)
          .values(
            items.map((m) => ({
              season,
              playerTag: m.tag,
              clanTag: c.tag,
              donated: m.donations ?? 0,
              received: m.donationsReceived ?? 0,
            })),
          )
          .onConflictDoUpdate({
            target: [s.donations.season, s.donations.playerTag, s.donations.clanTag],
            set: {
              donated: sql`greatest(${s.donations.donated}, excluded.donated)`,
              received: sql`greatest(${s.donations.received}, excluded.received)`,
              updatedAt: new Date(),
            },
          });
      return { clanTag: c.tag, ok: true, message: `${items.length} members saved for season ${season}` };
    } catch (e) {
      return { clanTag: c.tag, ok: false, message: (e as Error).message };
    }
  });
}

export async function clansInvolvedIn(db: DB, seasonId: string, clanTag: string) {
  return db
    .select()
    .from(s.cwlWars)
    .where(and(eq(s.cwlWars.seasonId, seasonId), or(eq(s.cwlWars.clanTag, clanTag), eq(s.cwlWars.opponentTag, clanTag))));
}

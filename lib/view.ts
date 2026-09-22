import { and, asc, desc, eq, inArray, isNotNull, lt, or } from "drizzle-orm";
import { getDb, schema as s, type DB } from "./db";
import {
  B2B_THRESHOLD,
  B2B_WINDOW,
  bonusCount,
  isAlt,
  isEligible,
  memberKey,
  starStealFlags,
  warResult,
  type StarStealFlag,
} from "./logic";

export type Season = typeof s.seasons.$inferSelect;

export async function listSeasons(): Promise<Season[]> {
  const db = await getDb();
  return db.select().from(s.seasons).orderBy(desc(s.seasons.sortKey));
}

export async function getSeason(id: string): Promise<Season | undefined> {
  const db = await getDb();
  const [row] = await db.select().from(s.seasons).where(eq(s.seasons.id, id));
  return row;
}

// Up to 6 seasons before `season`, most recent first.
export async function previousSeasons(db: DB, season: Season): Promise<Season[]> {
  return db
    .select()
    .from(s.seasons)
    .where(lt(s.seasons.sortKey, season.sortKey))
    .orderBy(desc(s.seasons.sortKey))
    .limit(B2B_WINDOW);
}

export interface ClanSummary {
  clanTag: string;
  clanName: string;
  cwlType: string;
  active: boolean;
  wins: number;
  losses: number;
  ties: number;
  roundsEnded: number;
  bonuses: number;
  bonusOverride: number | null;
  selected: number;
  eligible: number;
  recorded: number;
  lastSyncedAt: Date | null;
  syncMessage: string | null;
}

async function clanRecord(db: DB, seasonId: string, clanTag: string) {
  const wars = await db
    .select()
    .from(s.cwlWars)
    .where(
      and(
        eq(s.cwlWars.seasonId, seasonId),
        or(eq(s.cwlWars.clanTag, clanTag), eq(s.cwlWars.opponentTag, clanTag)),
      ),
    );
  let wins = 0,
    losses = 0,
    ties = 0;
  for (const w of wars) {
    const r = warResult(w, clanTag);
    if (r === "win") wins++;
    else if (r === "loss") losses++;
    else if (r === "tie") ties++;
  }
  return { wars, wins, losses, ties, roundsEnded: wins + losses + ties };
}

export async function seasonOverview(seasonId: string): Promise<ClanSummary[]> {
  const db = await getDb();
  const rows = await db
    .select({ cs: s.cwlClanSeasons, clan: s.clans })
    .from(s.cwlClanSeasons)
    .leftJoin(s.clans, eq(s.clans.tag, s.cwlClanSeasons.clanTag))
    .where(eq(s.cwlClanSeasons.seasonId, seasonId))
    .orderBy(asc(s.clans.sortOrder), asc(s.cwlClanSeasons.clanName));

  const out: ClanSummary[] = [];
  for (const { cs, clan } of rows) {
    const board = await clanBoard(seasonId, cs.clanTag, db);
    out.push({
      clanTag: cs.clanTag,
      clanName: board.clanName,
      cwlType: clan?.cwlType ?? "cwl",
      active: cs.active,
      wins: board.wins,
      losses: board.losses,
      ties: board.ties,
      roundsEnded: board.roundsEnded,
      bonuses: board.bonuses,
      bonusOverride: cs.bonusOverride,
      selected: board.rows.filter((r) => r.selected).length,
      eligible: board.rows.filter((r) => r.eligible).length,
      recorded: board.rows.filter((r) => r.recorded).length,
      lastSyncedAt: cs.lastSyncedAt,
      syncMessage: cs.syncMessage,
    });
  }
  return out;
}

export interface BoardRow {
  tag: string;
  name: string;
  townhall: number | null;
  attacks: number;
  attacksSource: "api" | "import" | "override" | "none";
  apiAttacks: number | null;
  importedAttacks: number | null;
  attacksOverride: number | null;
  stars: number;
  starSteal: StarStealFlag[];
  donated: number;
  received: number;
  donationsOverride: number | null;
  discordId: string | null;
  discordUsername: string | null;
  pn: number | null;
  isGuest: boolean;
  isAlt: boolean;
  memberKey: string;
  history: boolean[]; // aligned with prevSeasons
  recentBonuses: number;
  backToBack: boolean;
  eligible: boolean;
  selected: boolean;
  // Already in bonus history for this season, e.g. imported from the old sheet.
  recorded: boolean;
  transferToTag: string | null;
  remark: string | null;
  otherAccounts: { tag: string; name: string }[];
  // Selected in another clan this season (same member).
  selectedElsewhere: string | null;
}

export interface Board {
  season: Season;
  clanTag: string;
  clanName: string;
  cwlType: string;
  active: boolean;
  wins: number;
  losses: number;
  ties: number;
  roundsEnded: number;
  bonuses: number;
  bonusOverride: number | null;
  prevSeasons: Season[];
  rows: BoardRow[];
  hasApiData: boolean;
  lastSyncedAt: Date | null;
  syncMessage: string | null;
}

function countAttacks(override: number | null, fromApi: number | null, imported: number | null) {
  if (override != null) return { attacks: override, source: "override" as const };
  if (fromApi != null) return { attacks: fromApi, source: "api" as const };
  if (imported != null) return { attacks: imported, source: "import" as const };
  return { attacks: 0, source: "none" as const };
}

function otherAccountsOf(siblings: (typeof s.players.$inferSelect)[], discordId: string | null, tag: string) {
  if (!discordId) return [];
  const mine = siblings.filter((x) => x.discordId === discordId && x.tag !== tag);
  return mine.map((x) => ({ tag: x.tag, name: x.name }));
}

// Eligible players first, ordered by donations. Everyone else falls in behind them by attacks.
function compareBoardRows(a: BoardRow, b: BoardRow) {
  if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
  if (!a.eligible && a.attacks !== b.attacks) return b.attacks - a.attacks;
  if (a.donated !== b.donated) return b.donated - a.donated;
  if (a.received !== b.received) return b.received - a.received;
  return a.name.localeCompare(b.name);
}

export async function clanBoard(seasonId: string, clanTag: string, dbIn?: DB): Promise<Board> {
  const db = dbIn ?? (await getDb());
  const [season] = await db.select().from(s.seasons).where(eq(s.seasons.id, seasonId));
  if (!season) throw new Error(`Season ${seasonId} not found`);
  const [cs] = await db
    .select()
    .from(s.cwlClanSeasons)
    .where(and(eq(s.cwlClanSeasons.seasonId, seasonId), eq(s.cwlClanSeasons.clanTag, clanTag)));
  const [clan] = await db.select().from(s.clans).where(eq(s.clans.tag, clanTag));
  const rec = await clanRecord(db, seasonId, clanTag);
  const warTags = rec.wars.map((w) => w.warTag);

  const roster = await db
    .select()
    .from(s.cwlRoster)
    .where(and(eq(s.cwlRoster.seasonId, seasonId), eq(s.cwlRoster.clanTag, clanTag)));
  const warMembers = warTags.length
    ? await db
        .select()
        .from(s.cwlWarMembers)
        .where(and(inArray(s.cwlWarMembers.warTag, warTags), eq(s.cwlWarMembers.clanTag, clanTag)))
    : [];
  const attacks = warTags.length
    ? await db
        .select()
        .from(s.cwlAttacks)
        .where(and(inArray(s.cwlAttacks.warTag, warTags), eq(s.cwlAttacks.clanTag, clanTag)))
    : [];
  const parts = await db
    .select()
    .from(s.participants)
    .where(and(eq(s.participants.seasonId, seasonId), eq(s.participants.clanTag, clanTag)));

  const names = new Map<string, { name: string; th: number | null }>();
  for (const r of roster) names.set(r.playerTag, { name: r.name, th: r.townhall });
  for (const m of warMembers)
    names.set(m.playerTag, { name: m.name, th: m.townhall ?? names.get(m.playerTag)?.th ?? null });
  for (const p of parts)
    if (!names.has(p.playerTag)) names.set(p.playerTag, { name: p.name ?? "", th: null });
  const tags = [...names.keys()];

  const playerRows = tags.length ? await db.select().from(s.players).where(inArray(s.players.tag, tags)) : [];
  const playerBy = new Map(playerRows.map((p) => [p.tag, p]));

  // Their other accounts, for bonus transfers.
  const discordIds = [...new Set(playerRows.map((p) => p.discordId).filter(Boolean) as string[])];
  const siblings = discordIds.length
    ? await db.select().from(s.players).where(inArray(s.players.discordId, discordIds))
    : [];

  // Donations from the season this CWL scores on.
  const donationSeason = season.donationSeason ?? "";
  const dons = tags.length
    ? await db
        .select()
        .from(s.donations)
        .where(and(eq(s.donations.season, donationSeason), inArray(s.donations.playerTag, tags)))
    : [];
  const donBy = new Map<string, { donated: number; received: number; imported: boolean }>();
  for (const d of dons) {
    const cur = donBy.get(d.playerTag);
    if (d.clanTag === "IMPORT")
      donBy.set(d.playerTag, { donated: d.donated, received: d.received, imported: true });
    else if (!cur?.imported)
      donBy.set(d.playerTag, {
        donated: (cur?.donated ?? 0) + d.donated,
        received: (cur?.received ?? 0) + d.received,
        imported: false,
      });
  }
  // Player stats catch anyone who switched clans mid-season. An import still wins.
  const stats = tags.length
    ? await db
        .select()
        .from(s.playerStats)
        .where(and(eq(s.playerStats.season, donationSeason), inArray(s.playerStats.playerTag, tags)))
    : [];
  for (const st of stats) {
    const cur = donBy.get(st.playerTag);
    if (cur?.imported) continue;
    donBy.set(st.playerTag, {
      donated: Math.max(cur?.donated ?? 0, st.donated),
      received: Math.max(cur?.received ?? 0, st.received),
      imported: false,
    });
  }

  const prevSeasons = await previousSeasons(db, season);
  const prevIds = prevSeasons.map((p) => p.id);
  const hist = prevIds.length
    ? await db.select().from(s.bonusHistory).where(inArray(s.bonusHistory.seasonId, prevIds))
    : [];
  // Already in history for this season: imported, or from an earlier finalize.
  const recordedKeys = new Set(
    (await db.select().from(s.bonusHistory).where(eq(s.bonusHistory.seasonId, seasonId))).map(
      (h) => h.memberKey,
    ),
  );
  const histBy = new Map<string, Set<string>>();
  for (const h of hist) {
    if (!histBy.has(h.seasonId)) histBy.set(h.seasonId, new Set());
    histBy.get(h.seasonId)!.add(h.memberKey);
  }

  // Picks in other clans, so we can warn about giving one member two bonuses.
  const otherSelected = await db
    .select({ p: s.participants, pl: s.players })
    .from(s.participants)
    .leftJoin(s.players, eq(s.players.tag, s.participants.playerTag))
    .where(
      and(
        eq(s.participants.seasonId, seasonId),
        eq(s.participants.selected, true),
        isNotNull(s.participants.clanTag),
      ),
    );
  const selectedByMember = new Map<string, string>();
  for (const { p, pl } of otherSelected) {
    if (p.clanTag === clanTag) continue;
    selectedByMember.set(memberKey(pl?.discordId, p.playerTag), p.clanTag);
  }

  const partBy = new Map(parts.map((p) => [p.playerTag, p]));
  const hasApiData = rec.wars.length > 0;

  const rows: BoardRow[] = [];
  for (const tag of tags) {
    const pl = playerBy.get(tag);
    const part = partBy.get(tag);
    const mine = attacks.filter((a) => a.attackerTag === tag);
    const apiAttacks = hasApiData ? mine.length : null;
    const counted = countAttacks(part?.attacksOverride ?? null, apiAttacks, part?.importedAttacks ?? null);

    const don = donBy.get(tag);
    const key = memberKey(pl?.discordId, tag);
    const history = prevIds.map((id) => histBy.get(id)?.has(key) ?? false);
    const recent = history.filter(Boolean).length;
    const pn = pl?.pn ?? null;
    const isGuest = pl?.isGuest ?? false;

    let stars = 0;
    for (const a of mine) stars += a.stars;

    rows.push({
      tag,
      name: names.get(tag)?.name || pl?.name || tag,
      townhall: names.get(tag)?.th ?? null,
      attacks: counted.attacks,
      attacksSource: counted.source,
      apiAttacks,
      importedAttacks: part?.importedAttacks ?? null,
      attacksOverride: part?.attacksOverride ?? null,
      stars,
      starSteal: starStealFlags(mine),
      donated: part?.donationsOverride ?? don?.donated ?? 0,
      received: don?.received ?? 0,
      donationsOverride: part?.donationsOverride ?? null,
      discordId: pl?.discordId ?? null,
      discordUsername: pl?.discordUsername ?? null,
      pn,
      isGuest,
      isAlt: isAlt(pn),
      memberKey: key,
      history,
      recentBonuses: recent,
      backToBack: recent >= B2B_THRESHOLD,
      eligible: isEligible({ attacks: counted.attacks, pn, isGuest }),
      selected: part?.selected ?? false,
      recorded: recordedKeys.has(key),
      transferToTag: part?.transferToTag ?? null,
      remark: part?.remark ?? null,
      otherAccounts: otherAccountsOf(siblings, pl?.discordId ?? null, tag),
      selectedElsewhere: selectedByMember.get(key) ?? null,
    });
  }

  rows.sort(compareBoardRows);

  return {
    season,
    clanTag,
    clanName: cs?.clanName || clan?.name || clanTag,
    cwlType: clan?.cwlType ?? "cwl",
    active: cs?.active ?? true,
    wins: rec.wins,
    losses: rec.losses,
    ties: rec.ties,
    roundsEnded: rec.roundsEnded,
    bonuses: bonusCount(rec.wins, cs?.bonusOverride),
    bonusOverride: cs?.bonusOverride ?? null,
    prevSeasons,
    rows,
    hasApiData,
    lastSyncedAt: cs?.lastSyncedAt ?? null,
    syncMessage: cs?.syncMessage ?? null,
  };
}

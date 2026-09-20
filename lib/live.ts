import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { getDb, schema as s, type DB } from "./db";
import { REQUIRED_ATTACKS, warResult } from "./logic";

/** Donation totals per player for a game season. An IMPORT row wins over API snapshots. */
export async function donationTotals(db: DB, season: string, tags?: string[]) {
  const rows = await db
    .select()
    .from(s.donations)
    .where(tags?.length ? and(eq(s.donations.season, season), inArray(s.donations.playerTag, tags)) : eq(s.donations.season, season));
  const out = new Map<string, { donated: number; received: number; imported: boolean; clans: string[]; updatedAt: Date | null }>();
  for (const d of rows) {
    const cur = out.get(d.playerTag);
    if (d.clanTag === "IMPORT") {
      out.set(d.playerTag, { donated: d.donated, received: d.received, imported: true, clans: cur?.clans ?? [], updatedAt: d.updatedAt });
    } else if (cur?.imported) {
      cur.clans.push(d.clanTag);
    } else {
      out.set(d.playerTag, {
        donated: (cur?.donated ?? 0) + d.donated,
        received: (cur?.received ?? 0) + d.received,
        imported: false,
        clans: [...(cur?.clans ?? []), d.clanTag],
        updatedAt: !cur?.updatedAt || d.updatedAt > cur.updatedAt ? d.updatedAt : cur.updatedAt,
      });
    }
  }
  return out;
}

// ---------------- CWL attacks, round by round ----------------

export type CellState = "hit" | "missed" | "pending" | "prep" | "out";

export interface AttackCell {
  state: CellState;
  stars?: number;
  destruction?: number;
  defenderPosition?: number;
  position?: number;
}

export interface AttackRow {
  tag: string;
  name: string;
  townhall: number | null;
  cells: AttackCell[]; // one per round
  attacks: number;
  stars: number;
  inLineup: number;
  pending: number;
  missed: number;
}

export interface RoundInfo {
  round: number;
  state: string;
  opponentName: string;
  opponentTag: string;
  ourStars: number;
  theirStars: number;
  result: "win" | "loss" | "tie" | null;
}

export interface AttackBoard {
  clanTag: string;
  clanName: string;
  rounds: RoundInfo[];
  rows: AttackRow[];
  lastFetched: Date | null;
}

export async function attacksBoard(seasonId: string, clanTag: string, dbIn?: DB): Promise<AttackBoard> {
  const db = dbIn ?? (await getDb());
  const wars = await db
    .select()
    .from(s.cwlWars)
    .where(and(eq(s.cwlWars.seasonId, seasonId), or(eq(s.cwlWars.clanTag, clanTag), eq(s.cwlWars.opponentTag, clanTag))))
    .orderBy(asc(s.cwlWars.round));
  const [cs] = await db
    .select()
    .from(s.cwlClanSeasons)
    .where(and(eq(s.cwlClanSeasons.seasonId, seasonId), eq(s.cwlClanSeasons.clanTag, clanTag)));

  const rounds: RoundInfo[] = wars.map((w) => {
    const ours = w.clanTag === clanTag;
    return {
      round: w.round,
      state: w.state,
      opponentTag: ours ? w.opponentTag : w.clanTag,
      opponentName: (ours ? w.opponentName : w.clanName) || (ours ? w.opponentTag : w.clanTag),
      ourStars: ours ? w.clanStars : w.opponentStars,
      theirStars: ours ? w.opponentStars : w.clanStars,
      result: warResult(w, clanTag),
    };
  });

  const warTags = wars.map((w) => w.warTag);
  const members = warTags.length
    ? await db.select().from(s.cwlWarMembers).where(and(inArray(s.cwlWarMembers.warTag, warTags), eq(s.cwlWarMembers.clanTag, clanTag)))
    : [];
  const attacks = warTags.length
    ? await db.select().from(s.cwlAttacks).where(and(inArray(s.cwlAttacks.warTag, warTags), eq(s.cwlAttacks.clanTag, clanTag)))
    : [];
  const roster = await db
    .select()
    .from(s.cwlRoster)
    .where(and(eq(s.cwlRoster.seasonId, seasonId), eq(s.cwlRoster.clanTag, clanTag)));

  const roundOfWar = new Map(wars.map((w) => [w.warTag, w.round]));
  const stateOfRound = new Map(rounds.map((r) => [r.round, r.state]));
  const names = new Map<string, { name: string; th: number | null }>();
  for (const r of roster) names.set(r.playerTag, { name: r.name, th: r.townhall });
  for (const m of members) names.set(m.playerTag, { name: m.name, th: m.townhall ?? names.get(m.playerTag)?.th ?? null });

  const lineup = new Map<string, Map<number, number>>(); // player -> round -> map position
  for (const m of members) {
    const round = roundOfWar.get(m.warTag)!;
    if (!lineup.has(m.playerTag)) lineup.set(m.playerTag, new Map());
    lineup.get(m.playerTag)!.set(round, m.mapPosition);
  }
  const hits = new Map<string, Map<number, (typeof attacks)[number]>>();
  for (const a of attacks) {
    if (!hits.has(a.attackerTag)) hits.set(a.attackerTag, new Map());
    hits.get(a.attackerTag)!.set(a.round, a);
  }

  const roundNumbers = rounds.map((r) => r.round);
  const rows: AttackRow[] = [...names.keys()].map((tag) => {
    const cells: AttackCell[] = roundNumbers.map((round) => {
      const pos = lineup.get(tag)?.get(round);
      const hit = hits.get(tag)?.get(round);
      if (hit) return { state: "hit", stars: hit.stars, destruction: hit.destruction, defenderPosition: hit.defenderPosition, position: pos };
      if (pos == null) return { state: "out" };
      const warState = stateOfRound.get(round);
      // A war still in preparation cannot be attacked yet, so it is not an open attack.
      return { state: warState === "warEnded" ? "missed" : warState === "preparation" ? "prep" : "pending", position: pos };
    });
    return {
      tag,
      name: names.get(tag)?.name || tag,
      townhall: names.get(tag)?.th ?? null,
      cells,
      attacks: cells.filter((c) => c.state === "hit").length,
      stars: cells.reduce((n, c) => n + (c.stars ?? 0), 0),
      inLineup: cells.filter((c) => c.state !== "out").length,
      pending: cells.filter((c) => c.state === "pending").length,
      missed: cells.filter((c) => c.state === "missed").length,
    };
  });
  rows.sort((a, b) => b.attacks - a.attacks || b.stars - a.stars || a.name.localeCompare(b.name));

  return {
    clanTag,
    clanName: cs?.clanName || clanTag,
    rounds,
    rows,
    lastFetched: wars.reduce<Date | null>((d, w) => (!d || w.fetchedAt > d ? w.fetchedAt : d), null),
  };
}

export interface AttackSummary {
  clanTag: string;
  clanName: string;
  full: number;
  players: number;
  pending: number;
  missed: number;
  roundsEnded: number;
  liveRound: number | null;
}

export async function attacksOverview(seasonId: string): Promise<AttackSummary[]> {
  const db = await getDb();
  const clans = await db
    .select({ cs: s.cwlClanSeasons })
    .from(s.cwlClanSeasons)
    .leftJoin(s.clans, eq(s.clans.tag, s.cwlClanSeasons.clanTag))
    .where(eq(s.cwlClanSeasons.seasonId, seasonId))
    .orderBy(asc(s.clans.sortOrder), asc(s.cwlClanSeasons.clanName));

  const out: AttackSummary[] = [];
  for (const { cs } of clans) {
    const b = await attacksBoard(seasonId, cs.clanTag, db);
    out.push({
      clanTag: b.clanTag,
      clanName: b.clanName,
      players: b.rows.length,
      full: b.rows.filter((r) => r.attacks >= REQUIRED_ATTACKS).length,
      pending: b.rows.reduce((n, r) => n + r.pending, 0),
      missed: b.rows.reduce((n, r) => n + r.missed, 0),
      roundsEnded: b.rounds.filter((r) => r.state === "warEnded").length,
      liveRound: b.rounds.find((r) => r.state !== "warEnded")?.round ?? null,
    });
  }
  return out;
}

/** Totals across alliance clans for a season. */
export async function donationSummary(season: string) {
  const db = await getDb();
  const [row] = await db
    .select({
      players: sql<number>`count(distinct ${s.donations.playerTag})`,
      donated: sql<number>`coalesce(sum(${s.donations.donated}), 0)`,
    })
    .from(s.donations)
    .where(eq(s.donations.season, season));
  return { players: Number(row?.players ?? 0), donated: Number(row?.donated ?? 0) };
}

import { desc, eq, inArray } from "drizzle-orm";
import { getDb, schema as s } from "./db";
import { donationTotals } from "./live";

export interface StatRow {
  tag: string;
  name: string;
  clanTag: string | null;
  clanName: string | null;
  donated: number;
  received: number;
  net: number;
  ratio: number | null;
  attacks: number;
  attackWins: number;
  defenseWins: number;
  // false while a season is only partly covered by tracking.
  attacksComplete: boolean;
  trophies: number | null;
  townhall: number | null;
  discordUsername: string | null;
  discordId: string | null;
  isTracked: boolean;
  inFamilyClan: boolean;
  updatedAt: Date | null;
}

export interface StatsBoard {
  season: string;
  rows: StatRow[];
  clans: { tag: string; name: string }[];
  lastUpdated: Date | null;
  totals: { players: number; donated: number; received: number; attacks: number; rankedWins: number };
}

export async function statsSeasons(): Promise<string[]> {
  const db = await getDb();
  const a = await db.selectDistinct({ season: s.playerStats.season }).from(s.playerStats);
  const b = await db.selectDistinct({ season: s.donations.season }).from(s.donations);
  return [...new Set([...a, ...b].map((r) => r.season))].sort().reverse();
}

// Donations fall back to the old clan snapshots for seasons we tracked before
// player stats existed.
export async function statsBoard(season: string): Promise<StatsBoard> {
  const db = await getDb();
  const stats = await db
    .select()
    .from(s.playerStats)
    .where(eq(s.playerStats.season, season))
    .orderBy(desc(s.playerStats.donated));
  const legacy = await donationTotals(db, season);

  const tags = [...new Set([...stats.map((r) => r.playerTag), ...legacy.keys()])];
  const players = tags.length ? await db.select().from(s.players).where(inArray(s.players.tag, tags)) : [];
  const playerBy = new Map(players.map((p) => [p.tag, p]));
  const clanRows = await db.select().from(s.clans).where(eq(s.clans.isAlliance, true));
  const familyTags = new Set(clanRows.map((c) => c.tag));
  const statBy = new Map(stats.map((r) => [r.playerTag, r]));

  let lastUpdated: Date | null = null;
  const rows: StatRow[] = [];

  for (const tag of tags) {
    const st = statBy.get(tag);
    const old = legacy.get(tag);
    const p = playerBy.get(tag);
    if (st?.updatedAt && (!lastUpdated || st.updatedAt > lastUpdated)) lastUpdated = st.updatedAt;

    const donated = Math.max(st?.donated ?? 0, old?.donated ?? 0);
    const received = Math.max(st?.received ?? 0, old?.received ?? 0);

    let attacks = 0;
    if (st?.attacksTotal != null && st.attacksBase != null) {
      attacks = Math.max(0, st.attacksTotal - st.attacksBase);
    }

    rows.push({
      tag,
      name: st?.name || p?.name || tag,
      clanTag: st?.clanTag ?? null,
      clanName: st?.clanName ?? null,
      donated,
      received,
      net: donated - received,
      ratio: received > 0 ? donated / received : null,
      attacks,
      attackWins: st?.attackWins ?? 0,
      defenseWins: st?.defenseWins ?? 0,
      attacksComplete: st?.attacksBase != null,
      trophies: st?.trophies ?? null,
      townhall: st?.townhall ?? null,
      discordUsername: p?.discordUsername ?? null,
      discordId: p?.discordId ?? null,
      isTracked: p?.isTracked ?? false,
      inFamilyClan: st?.clanTag ? familyTags.has(st.clanTag) : false,
      updatedAt: st?.updatedAt ?? old?.updatedAt ?? null,
    });
  }

  rows.sort((a, b) => {
    if (a.donated !== b.donated) return b.donated - a.donated;
    return a.name.localeCompare(b.name);
  });

  const totals = { players: rows.length, donated: 0, received: 0, attacks: 0, rankedWins: 0 };
  for (const r of rows) {
    totals.donated += r.donated;
    totals.received += r.received;
    totals.attacks += r.attacks;
    totals.rankedWins += r.attackWins;
  }

  return {
    season,
    rows,
    clans: clanRows.map((c) => ({ tag: c.tag, name: c.name || c.tag })),
    lastUpdated,
    totals,
  };
}

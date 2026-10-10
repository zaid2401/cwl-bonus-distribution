export const BASE_BONUS = 6;
export const REQUIRED_ATTACKS = 7;
export const STAR_REQUIREMENT = 8;
export const B2B_WINDOW = 6;
export const B2B_THRESHOLD = 3;

export type WarResult = "win" | "loss" | "tie" | null;

export interface WarRow {
  clanTag: string;
  opponentTag: string;
  state: string;
  clanStars: number;
  clanDestruction: number;
  opponentStars: number;
  opponentDestruction: number;
}

// More stars wins; equal stars go to the higher destruction.
export function warResult(w: WarRow, ourTag: string): WarResult {
  if (w.state !== "warEnded") return null;
  const ours = w.clanTag === ourTag;
  const [s1, d1, s2, d2] = ours
    ? [w.clanStars, w.clanDestruction, w.opponentStars, w.opponentDestruction]
    : [w.opponentStars, w.opponentDestruction, w.clanStars, w.clanDestruction];
  if (s1 !== s2) return s1 > s2 ? "win" : "loss";
  if (d1 !== d2) return d1 > d2 ? "win" : "loss";
  return "tie";
}

export function bonusCount(wins: number, override: number | null | undefined): number {
  return override ?? BASE_BONUS + wins;
}

export interface AttackRow {
  round: number;
  order: number;
  attackerTag: string;
  attackerPosition: number;
  defenderPosition: number;
  stars: number;
}

export interface StarStealFlag {
  round: number;
  attackerPosition: number;
  defenderPosition: number;
  stars: number;
  starsBefore: number;
}

// Star stealing: once a player has their 8 stars, hitting a base below their own
// war position (a bigger number) is a farm hit, not a real attack.
export function starStealFlags(attacks: AttackRow[]): StarStealFlag[] {
  const sorted = [...attacks].sort((a, b) => a.round - b.round || a.order - b.order);
  const flags: StarStealFlag[] = [];
  let total = 0;
  for (const a of sorted) {
    if (total >= STAR_REQUIREMENT && a.defenderPosition > a.attackerPosition) {
      flags.push({
        round: a.round,
        attackerPosition: a.attackerPosition,
        defenderPosition: a.defenderPosition,
        stars: a.stars,
        starsBefore: total,
      });
    }
    total += a.stars;
  }
  return flags;
}

export function memberKey(discordId: string | null | undefined, tag: string): string {
  return discordId?.trim() ? discordId.trim() : `tag:${tag}`;
}

export const isAlt = (pn: number | null | undefined) => pn != null && pn >= 2;

// An excuse covers the attacks and nothing else. You can have a genuine reason for missing a
// war; you cannot have one for being somebody's alt or for having left the alliance.
export function isEligible(p: {
  attacks: number;
  pn: number | null;
  isAltAccount: boolean;
  leftJpa: boolean;
  excused?: boolean;
}): boolean {
  const attacked = p.attacks >= REQUIRED_ATTACKS || !!p.excused;
  return attacked && !isAlt(p.pn) && !p.isAltAccount && !p.leftJpa;
}

// An override beats the API, and the API beats whatever a sheet said.
export function countAttacks(override: number | null, fromApi: number | null, imported: number | null) {
  if (override != null) return { attacks: override, source: "override" as const };
  if (fromApi != null) return { attacks: fromApi, source: "api" as const };
  if (imported != null) return { attacks: imported, source: "import" as const };
  return { attacks: 0, source: "none" as const };
}

// Only the fields the order depends on, so this stays testable without a board row.
export interface SortableRow {
  eligible: boolean;
  attacks: number;
  donated: number | null;
  received: number | null;
  name: string;
}

// Eligible players first, ordered by donations. Everyone else falls in behind them by
// attacks, and anyone the sheet does not mention sits below anyone it does.
export function compareBoardRows(a: SortableRow, b: SortableRow) {
  if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
  if (!a.eligible && a.attacks !== b.attacks) return b.attacks - a.attacks;
  const donated = (b.donated ?? -1) - (a.donated ?? -1);
  if (donated) return donated;
  const received = (b.received ?? -1) - (a.received ?? -1);
  if (received) return received;
  return a.name.localeCompare(b.name);
}

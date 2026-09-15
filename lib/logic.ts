/** Pure bonus logic — no database access, unit tested. */

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

/** Result from `ourTag`'s point of view. Only ended wars count. More stars wins, then higher destruction. */
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

/**
 * Replays a player's attacks in order. Once they already have 8+ stars,
 * any attack on a base numbered below their own war position (a higher number) is flagged.
 */
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

/** How many of the given previous seasons (already limited to the window) this member got a bonus in. */
export function recentBonusCount(member: string, prevSeasonIds: string[], history: Map<string, Set<string>>): number {
  return prevSeasonIds.filter((s) => history.get(s)?.has(member)).length;
}

export const isAlt = (pn: number | null | undefined) => pn != null && pn >= 2;

export function isEligible(p: { attacks: number; pn: number | null; isGuest: boolean }): boolean {
  return p.attacks >= REQUIRED_ATTACKS && !isAlt(p.pn) && !p.isGuest;
}

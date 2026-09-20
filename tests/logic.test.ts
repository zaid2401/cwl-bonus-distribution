import { test } from "node:test";
import assert from "node:assert/strict";
import { bonusCount, isEligible, starStealFlags, warResult } from "../lib/logic";
import { cwlSeasonId, gameSeasonAt, guessSeasonFromHeader, normTag, prevMonth } from "../lib/util";
import { parseCsv } from "../lib/csv";

const war = (cs: number, cd: number, os: number, od: number, state = "warEnded") => ({
  clanTag: "#A",
  opponentTag: "#B",
  state,
  clanStars: cs,
  clanDestruction: cd,
  opponentStars: os,
  opponentDestruction: od,
});

test("war result: stars, then destruction, from either side", () => {
  assert.equal(warResult(war(30, 90, 28, 95), "#A"), "win");
  assert.equal(warResult(war(30, 90, 28, 95), "#B"), "loss");
  assert.equal(warResult(war(28, 96, 28, 95), "#A"), "win");
  assert.equal(warResult(war(28, 95, 28, 95), "#B"), "tie");
  assert.equal(warResult(war(30, 90, 0, 0, "inWar"), "#A"), null);
});

test("bonus count = 6 + wins unless overridden", () => {
  assert.equal(bonusCount(0, null), 6);
  assert.equal(bonusCount(5, null), 11);
  assert.equal(bonusCount(5, 4), 4);
});

test("eligibility: 7 attacks, main, not guest", () => {
  assert.equal(isEligible({ attacks: 7, pn: null, isGuest: false }), true);
  assert.equal(isEligible({ attacks: 7, pn: 1, isGuest: false }), true);
  assert.equal(isEligible({ attacks: 6, pn: 1, isGuest: false }), false);
  assert.equal(isEligible({ attacks: 7, pn: 2, isGuest: false }), false);
  assert.equal(isEligible({ attacks: 7, pn: 1, isGuest: true }), false);
});

test("star steal: only flagged after 8 stars and hitting a lower base", () => {
  const a = (round: number, def: number, stars: number, pos = 5) => ({
    round,
    order: 1,
    attackerTag: "#P",
    attackerPosition: pos,
    defenderPosition: def,
    stars,
  });
  // under 8 stars, so hitting a low base is fine
  // past 8 stars, the low base in round 4 gets flagged
  const flags = starStealFlags([a(6, 2, 2), a(1, 5, 3), a(2, 8, 3), a(3, 9, 3), a(4, 10, 3), a(5, 5, 2)]);
  assert.deepEqual(
    flags.map((f) => [f.round, f.starsBefore]),
    [[4, 9]],
  );
  // exactly 8 counts too
  assert.equal(starStealFlags([a(1, 1, 3), a(2, 1, 3), a(3, 1, 2), a(4, 6, 3)]).length, 1);
});

test("season helpers", () => {
  // Aug 2026 resets on Monday the 31st at 05:00 UTC
  assert.equal(gameSeasonAt(new Date("2026-08-31T04:59:00Z")), "2026-08");
  assert.equal(gameSeasonAt(new Date("2026-08-31T05:00:00Z")), "2026-09");
  assert.equal(gameSeasonAt(new Date("2026-12-28T06:00:00Z")), "2027-01");
  assert.equal(prevMonth("2026-01"), "2025-12");
  assert.deepEqual(guessSeasonFromHeader("JULY", new Date("2026-09-14")), { id: "2026-07", sortKey: "2026-07-01" });
  assert.deepEqual(guessSeasonFromHeader("6/2/2026"), { id: "2026-06", sortKey: "2026-06-02" });
  assert.equal(normTag(" #2pp o "), "#2PP0");
});

test("CWL season id is keyed by month, whatever start date the API reports", () => {
  // groups start on different days, so clans report different season strings
  assert.equal(cwlSeasonId("2026-09-01"), "2026-09");
  assert.equal(cwlSeasonId("2026-09-02"), "2026-09");
  assert.equal(cwlSeasonId("2026-09"), "2026-09");
  assert.equal(cwlSeasonId(""), "");
});

test("csv parser handles quotes and newlines", () => {
  assert.deepEqual(parseCsv('a,"b,c","d ""e"""\r\n1,"x\ny",3'), [
    ["a", "b,c", 'd "e"'],
    ["1", "x\ny", "3"],
  ]);
});

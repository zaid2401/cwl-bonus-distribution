import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bonusCount,
  compareBoardRows,
  countAttacks,
  isEligible,
  starStealFlags,
  warResult,
  type SortableRow,
} from "../lib/logic";
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

test("eligibility: 7 attacks, main, not an alt, still in the alliance", () => {
  const base = { attacks: 7, pn: 1, isAltAccount: false, leftJpa: false };
  assert.equal(isEligible({ ...base, pn: null }), true);
  assert.equal(isEligible(base), true);
  assert.equal(isEligible({ ...base, attacks: 6 }), false);
  assert.equal(isEligible({ ...base, pn: 2 }), false);
  assert.equal(isEligible({ ...base, isAltAccount: true }), false);
  assert.equal(isEligible({ ...base, leftJpa: true }), false);
});

test("star steal: only past 8 stars, and only well below their own position", () => {
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
  // exactly 8 counts too, and #5 hitting #9 is two clear of the margin
  const eight = [a(1, 1, 3), a(2, 1, 3), a(3, 1, 2)];
  assert.equal(starStealFlags([...eight, a(4, 9, 3)]).length, 1);
  // the margin: at #5, both #6 and #7 are a fair fight, #8 is not
  assert.equal(starStealFlags([...eight, a(4, 6, 3)]).length, 0);
  assert.equal(starStealFlags([...eight, a(4, 7, 3)]).length, 0);
  assert.equal(starStealFlags([...eight, a(4, 8, 3)]).length, 1);
});

test("season helpers", () => {
  // Aug 2026 resets on Monday the 31st at 05:00 UTC
  assert.equal(gameSeasonAt(new Date("2026-08-31T04:59:00Z")), "2026-08");
  assert.equal(gameSeasonAt(new Date("2026-08-31T05:00:00Z")), "2026-09");
  assert.equal(gameSeasonAt(new Date("2026-12-28T06:00:00Z")), "2027-01");
  assert.equal(prevMonth("2026-01"), "2025-12");
  assert.deepEqual(guessSeasonFromHeader("JULY", new Date("2026-09-14")), {
    id: "2026-07",
    sortKey: "2026-07-01",
  });
  assert.deepEqual(guessSeasonFromHeader("6/2/2026"), { id: "2026-06", sortKey: "2026-06-02" });
  assert.equal(normTag(" #2pp o "), "#2PP0");
});

test("an excuse stands in for the attacks and nothing else", () => {
  const base = { attacks: 3, pn: 1, isAltAccount: false, leftJpa: false };
  assert.equal(isEligible(base), false);
  assert.equal(isEligible({ ...base, excused: true }), true);
  // The other three are not things you can have a genuine reason for.
  assert.equal(isEligible({ ...base, excused: true, pn: 2 }), false);
  assert.equal(isEligible({ ...base, excused: true, isAltAccount: true }), false);
  assert.equal(isEligible({ ...base, excused: true, leftJpa: true }), false);
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

test("attacks: an override wins, then the API, then the sheet", () => {
  assert.deepEqual(countAttacks(3, 7, 5), { attacks: 3, source: "override" });
  assert.deepEqual(countAttacks(null, 7, 5), { attacks: 7, source: "api" });
  assert.deepEqual(countAttacks(null, null, 5), { attacks: 5, source: "import" });
  assert.deepEqual(countAttacks(null, null, null), { attacks: 0, source: "none" });
  // A real zero from the API is not the same as no API data at all.
  assert.deepEqual(countAttacks(null, 0, 5), { attacks: 0, source: "api" });
  assert.deepEqual(countAttacks(0, 7, 5), { attacks: 0, source: "override" });
});

test("board order: eligible first, then donations, and blanks last", () => {
  const row = (p: Partial<SortableRow>): SortableRow => ({
    eligible: true,
    attacks: 7,
    donated: 0,
    received: 0,
    name: "x",
    ...p,
  });
  const sorted = (rows: SortableRow[]) => [...rows].sort(compareBoardRows).map((r) => r.name);

  assert.deepEqual(
    sorted([row({ name: "out", eligible: false }), row({ name: "in" })]),
    ["in", "out"],
    "eligible beats everything",
  );
  assert.deepEqual(sorted([row({ name: "low", donated: 10 }), row({ name: "high", donated: 900 })]), [
    "high",
    "low",
  ]);
  assert.deepEqual(
    sorted([row({ name: "none", donated: null }), row({ name: "zero", donated: 0 })]),
    ["zero", "none"],
    "nobody the sheet mentions sits below someone it does not",
  );
  assert.deepEqual(
    sorted([
      row({ name: "fewer", eligible: false, attacks: 2 }),
      row({ name: "more", eligible: false, attacks: 6 }),
    ]),
    ["more", "fewer"],
    "ineligible players sort by attacks, not donations",
  );
  assert.deepEqual(
    sorted([row({ name: "b", received: 1 }), row({ name: "a", received: 9 })]),
    ["a", "b"],
    "equal donations break on received",
  );
  assert.deepEqual(sorted([row({ name: "Zed" }), row({ name: "Abe" })]), ["Abe", "Zed"]);
});

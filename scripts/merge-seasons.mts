/*
 * Merge one season into another, keeping every row.
 * npx tsx scripts/merge-seasons.mts 2026-09-02 2026-09
 */
import { sql } from "drizzle-orm";
import { getDb } from "../lib/db";
import { prevMonth, seasonLabel } from "../lib/util";

const [from, into] = process.argv.slice(2);
if (!from || !into) {
  console.error("Usage: npx tsx scripts/merge-seasons.mts <from-season-id> <into-season-id>");
  process.exit(1);
}

const db = await getDb();
const n = async (q: ReturnType<typeof sql>) => {
  const r = (await db.execute(q)) as unknown as { rowCount?: number; count?: number };
  return r.rowCount ?? r.count ?? 0;
};

await db.execute(sql`
  insert into seasons (id, label, sort_key, donation_season, has_cwl_data)
  values (${into}, ${seasonLabel(into)}, ${into + "-01"}, ${/^\d{4}-\d{2}$/.test(into) ? prevMonth(into) : null}, true)
  on conflict (id) do update set has_cwl_data = true
`);

// Move rows across, skipping ones the target season already has.
for (const [table, keys] of [
  ["cwl_clan_seasons", ["season_id", "clan_tag"]],
  ["cwl_roster", ["season_id", "clan_tag", "player_tag"]],
  ["participants", ["season_id", "clan_tag", "player_tag"]],
  ["bonus_history", ["season_id", "member_key"]],
] as const) {
  const cols = keys.slice(1).map((k) => sql.raw(`t.${k} = x.${k}`));
  const moved = await n(sql`
    update ${sql.raw(table)} t set season_id = ${into}
    where t.season_id = ${from}
      and not exists (select 1 from ${sql.raw(table)} x where x.season_id = ${into} and ${sql.join(cols, sql` and `)})
  `);
  const dropped = await n(sql`delete from ${sql.raw(table)} where season_id = ${from}`);
  console.log(`${table}: moved ${moved}, dropped ${dropped} duplicate(s)`);
}

console.log(`cwl_wars: moved ${await n(sql`update cwl_wars set season_id = ${into} where season_id = ${from}`)}`);
console.log(`seasons: removed ${await n(sql`delete from seasons where id = ${from}`)}`);
process.exit(0);

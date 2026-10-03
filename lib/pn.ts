import { and, eq } from "drizzle-orm";
import { schema as s, type DB } from "./db";
import { jpaApplications, jpaSeasons, matchSeason } from "./jpa";
import { normTag } from "./util";

// PN is decided when a member applies for CWL on clashwithjpa.com, so it is read from there
// rather than typed in twice. Shared by the Sync PN button and `npm run sync-pn`, because
// Cloudflare turns away the serverless call and lets a laptop through.
export async function applyPreferenceNumbers(db: DB, seasonId: string): Promise<string> {
  const [season] = await db.select().from(s.seasons).where(eq(s.seasons.id, seasonId));
  if (!season) throw new Error(`Season ${seasonId} not found.`);
  const theirs = matchSeason(seasonId, await jpaSeasons());
  if (!theirs) throw new Error(`clashwithjpa has no CWL season for ${season.label}.`);

  const apps = await jpaApplications(theirs.id);
  const pnByTag = new Map<string, number>();
  for (const a of apps) {
    const tag = normTag(a.cocAccountTag);
    // Someone can apply with several accounts; the keenest number wins.
    const seen = pnByTag.get(tag);
    if (seen == null || a.preferenceNum < seen) pnByTag.set(tag, a.preferenceNum);
  }

  const rows = await db.select().from(s.participants).where(eq(s.participants.seasonId, seasonId));
  let changed = 0;
  for (const row of rows) {
    const pn = pnByTag.get(row.playerTag) ?? null;
    if (pn == null || pn === row.pn) continue;
    await db
      .update(s.participants)
      .set({ pn })
      .where(
        and(
          eq(s.participants.seasonId, seasonId),
          eq(s.participants.clanTag, row.clanTag),
          eq(s.participants.playerTag, row.playerTag),
        ),
      );
    changed++;
  }
  const missing = rows.filter((r) => !pnByTag.has(r.playerTag)).length;
  return (
    `${theirs.name}: ${apps.length} applications, PN set on ${changed} board row(s).` +
    (missing ? ` ${missing} row(s) had no application — they keep their saved PN.` : "")
  );
}

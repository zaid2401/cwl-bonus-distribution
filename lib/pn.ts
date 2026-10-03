import { and, eq, inArray, sql } from "drizzle-orm";
import { schema as s, type DB } from "./db";
import { jpaApplications, jpaSeasons, matchSeason } from "./jpa";
import { normTag } from "./util";

// Every player the season's boards show, which is not the same as the players who have a
// participants row: those are written lazily, the first time someone ticks or edits
// something. The boards read the roster and the war line-ups, so this has to as well.
async function boardPlayers(db: DB, seasonId: string) {
  const clans = await db
    .select()
    .from(s.cwlClanSeasons)
    .where(and(eq(s.cwlClanSeasons.seasonId, seasonId), eq(s.cwlClanSeasons.active, true)));
  const clanTags = clans.map((c) => c.clanTag);
  if (!clanTags.length) return [];

  const roster = await db
    .select({ clanTag: s.cwlRoster.clanTag, playerTag: s.cwlRoster.playerTag, name: s.cwlRoster.name })
    .from(s.cwlRoster)
    .where(and(eq(s.cwlRoster.seasonId, seasonId), inArray(s.cwlRoster.clanTag, clanTags)));

  const wars = await db
    .select({ warTag: s.cwlWars.warTag })
    .from(s.cwlWars)
    .where(eq(s.cwlWars.seasonId, seasonId));
  const warTags = wars.map((w) => w.warTag);
  // Both sides of a war are in cwl_war_members, so this filters down to our own clans.
  const members = warTags.length
    ? await db
        .select({
          clanTag: s.cwlWarMembers.clanTag,
          playerTag: s.cwlWarMembers.playerTag,
          name: s.cwlWarMembers.name,
        })
        .from(s.cwlWarMembers)
        .where(and(inArray(s.cwlWarMembers.warTag, warTags), inArray(s.cwlWarMembers.clanTag, clanTags)))
    : [];

  const existing = await db
    .select({
      clanTag: s.participants.clanTag,
      playerTag: s.participants.playerTag,
      name: s.participants.name,
    })
    .from(s.participants)
    .where(eq(s.participants.seasonId, seasonId));

  const byPair = new Map<string, { clanTag: string; playerTag: string; name: string | null }>();
  for (const r of [...roster, ...members, ...existing]) byPair.set(`${r.clanTag}|${r.playerTag}`, r);
  return [...byPair.values()];
}

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

  const players = await boardPlayers(db, seasonId);
  const rows = players
    .filter((p) => pnByTag.has(p.playerTag))
    .map((p) => ({
      seasonId,
      clanTag: p.clanTag,
      playerTag: p.playerTag,
      name: p.name || null,
      pn: pnByTag.get(p.playerTag)!,
    }));

  // A player with no application is left alone: no row invented, no PN cleared.
  for (let i = 0; i < rows.length; i += 200) {
    await db
      .insert(s.participants)
      .values(rows.slice(i, i + 200))
      .onConflictDoUpdate({
        target: [s.participants.seasonId, s.participants.clanTag, s.participants.playerTag],
        set: { pn: sql`excluded.pn` },
      });
  }

  const missing = players.length - rows.length;
  return (
    `${theirs.name}: ${apps.length} applications matched against ${players.length} players on the boards. ` +
    `PN written for ${rows.length}.` +
    (missing ? ` ${missing} had no application and were left blank.` : "")
  );
}

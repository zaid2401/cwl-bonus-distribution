// Reads preference numbers from clashwithjpa.com and writes them onto a season's boards.
//
//   npm run sync-pn            # the newest season
//   npm run sync-pn 2026-10    # a particular one
//
// This exists because Cloudflare challenges the call when it comes from Vercel, and a
// laptop gets through. It reads DATABASE_URL and JPA_API_KEY out of .env.local, so it
// writes to whatever that points at — production, normally.
import fs from "node:fs";
import { desc } from "drizzle-orm";

for (const file of [".env.local", ".env"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    // Keys here are sometimes written as `NAME =value`, and values are sometimes quoted.
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    // Only fill in what the shell left out. A variable set to "" on the command line is a
    // deliberate choice — DATABASE_URL= means the local database — not an absence.
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const { getDb, schema: s } = await import("../lib/db/index.ts");
const { applyPreferenceNumbers } = await import("../lib/pn.ts");

const db = await getDb();
let seasonId = process.argv[2];
if (!seasonId) {
  const [latest] = await db.select().from(s.seasons).orderBy(desc(s.seasons.sortKey)).limit(1);
  if (!latest) throw new Error("No seasons in the database yet.");
  seasonId = latest.id;
}

console.log(`Season ${seasonId} →`, await applyPreferenceNumbers(db, seasonId));
process.exit(0);

import Link from "next/link";
import { and, asc, ilike, isNull, or, type SQL } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import { PlayersTable } from "@/components/PlayersTable";

export const dynamic = "force-dynamic";

export default async function PlayersPage(props: PageProps<"/players">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const missing = sp.missing === "1";
  const db = await getDb();
  const conds: SQL[] = [];
  if (q) {
    const like = `%${q}%`;
    conds.push(
      or(
        ilike(s.players.name, like),
        ilike(s.players.tag, like),
        ilike(s.players.discordUsername, like),
        ilike(s.players.discordId, like),
      )!,
    );
  }
  if (missing) conds.push(isNull(s.players.discordId));
  const rows = await db
    .select()
    .from(s.players)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(s.players.discordUsername), asc(s.players.pn), asc(s.players.name))
    .limit(500);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Players</h1>
        <p className="text-muted">
          Discord links, priority numbers (PN1 = main, PN2+ = alt) and guest flags. Players are added
          automatically by syncs and imports.
        </p>
      </div>
      <form className="flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} className="input w-72" placeholder="Search name, tag, Discord…" />
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="missing" value="1" defaultChecked={missing} /> Missing Discord ID only
        </label>
        <button className="btn">Filter</button>
        {(q || missing) && (
          <Link href="/players" className="text-sm text-muted underline">
            clear
          </Link>
        )}
        <span className="ml-auto text-sm text-muted">
          {rows.length === 500 ? "Showing first 500" : `${rows.length} players`}
        </span>
      </form>
      <PlayersTable
        rows={rows.map((r) => ({
          tag: r.tag,
          name: r.name,
          discordId: r.discordId,
          discordUsername: r.discordUsername,
          pn: r.pn,
          isGuest: r.isGuest,
          notes: r.notes,
        }))}
      />
    </div>
  );
}

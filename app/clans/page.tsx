import { asc, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import { ClansManager } from "@/components/ClansManager";
import { currentCwlSeason, seasonLabel } from "@/lib/util";

export const dynamic = "force-dynamic";

export default async function ClansPage() {
  const db = await getDb();
  const clans = await db.select().from(s.clans).orderBy(asc(s.clans.sortOrder), asc(s.clans.name));
  const seasonId = currentCwlSeason();
  const [season] = await db.select().from(s.seasons).where(eq(s.seasons.id, seasonId));
  const used = await db.select().from(s.cwlClanSeasons).where(eq(s.cwlClanSeasons.seasonId, seasonId));
  const inUse = new Map(used.map((u) => [u.clanTag, u.active]));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Clans</h1>
        <p className="text-muted">
          Every clan here is synced for CWL attacks and wins. <b>In use</b> says which ones you are running in{" "}
          {seasonLabel(seasonId)} — syncing ticks a clan as soon as it turns up in a league group, and
          unticking leaves it out of that season's totals, export and sync.
        </p>
      </div>
      <ClansManager
        seasonId={seasonId}
        seasonLabel={seasonLabel(seasonId)}
        finalized={season?.status === "finalized"}
        clans={clans.map((c) => ({
          tag: c.tag,
          name: c.name,
          sortOrder: c.sortOrder,
          inUse: inUse.get(c.tag) ?? false,
        }))}
      />
    </div>
  );
}

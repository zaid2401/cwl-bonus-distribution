import { asc, desc } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import { ImportTabs } from "@/components/ImportTabs";
import { prevMonth, gameSeasonAt } from "@/lib/util";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const db = await getDb();
  const clans = await db.select().from(s.clans).orderBy(asc(s.clans.sortOrder));
  const seasons = await db.select().from(s.seasons).orderBy(desc(s.seasons.sortKey));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Import</h1>
        <p className="text-muted">
          Paste a Google Sheet link (sharing: “Anyone with the link can view”, with the right tab open) or paste CSV text directly.
        </p>
      </div>
      <ImportTabs
        clans={clans.map((c) => ({ tag: c.tag, name: c.name }))}
        seasons={seasons.map((x) => ({ id: x.id, label: x.label }))}
        defaultDonationSeason={prevMonth(gameSeasonAt(new Date()))}
      />
    </div>
  );
}

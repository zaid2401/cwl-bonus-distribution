import { asc } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import { ClansManager } from "@/components/ClansManager";

export const dynamic = "force-dynamic";

export default async function ClansPage() {
  const db = await getDb();
  const clans = await db.select().from(s.clans).orderBy(asc(s.clans.sortOrder), asc(s.clans.name));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Clans</h1>
        <p className="text-muted">
          <b>CWL</b> clans are synced for CWL attacks and wins. <b>Alliance</b> clans have donations tracked (all combined). A
          clan can be both.
        </p>
      </div>
      <ClansManager clans={clans.map((c) => ({ tag: c.tag, name: c.name, cwlType: c.cwlType, isAlliance: c.isAlliance, sortOrder: c.sortOrder }))} />
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { count } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import { listSeasons } from "@/lib/view";
import { ActionButton } from "@/components/ActionButton";
import { syncAll } from "@/lib/actions";
import { NewSeasonForm } from "@/components/NewSeasonForm";
import { currentRole } from "@/lib/session";
import { gameSeasonAt } from "@/lib/util";

export const dynamic = "force-dynamic";

export default async function Home() {
  const db = await getDb();
  const seasons = await listSeasons();

  // The bonus leader has no use for the season list: send them straight to the CWL on now.
  if ((await currentRole()) === "bonus") {
    if (!seasons[0])
      return <div className="card p-4 text-muted">No CWL season yet. Check back once one is synced.</div>;
    redirect(`/seasons/${encodeURIComponent(seasons[0].id)}`);
  }

  const [{ n: cwlClans }] = await db.select({ n: count() }).from(s.clans);
  const counts = await db
    .select({ seasonId: s.cwlClanSeasons.seasonId, n: count() })
    .from(s.cwlClanSeasons)
    .groupBy(s.cwlClanSeasons.seasonId);
  const clanCount = new Map(counts.map((c) => [c.seasonId, c.n]));
  const tokenSet = Boolean(process.env.COC_API_TOKEN);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Seasons</h1>
          <p className="text-muted">
            {cwlClans} CWL clan(s) · current donation season {gameSeasonAt(new Date())}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <ActionButton action={syncAll} className="btn btn-primary" pendingText="Syncing CWL…">
            Sync CWL now
          </ActionButton>
        </div>
      </div>

      {!tokenSet && (
        <div className="card border-warn/50 p-4 text-warn">
          COC_API_TOKEN is not set — syncing is disabled. You can still use imports and manual editing. See
          Settings.
        </div>
      )}
      {cwlClans === 0 && (
        <div className="card p-4">
          No CWL clans yet.{" "}
          <Link href="/clans" className="text-accent underline">
            Add your clan tags
          </Link>{" "}
          to get started.
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="th">Season</th>
              <th className="th">Id</th>
              <th className="th">Donations from</th>
              <th className="th">Clans</th>
              <th className="th">Status</th>
            </tr>
          </thead>
          <tbody>
            {seasons.map((se) => (
              <tr key={se.id} className="hover:bg-panel2">
                <td className="td">
                  <Link
                    href={`/seasons/${encodeURIComponent(se.id)}`}
                    className="font-semibold text-accent hover:underline"
                  >
                    {se.label}
                  </Link>
                </td>
                <td className="td text-muted">{se.id}</td>
                <td className="td text-muted">{se.donationSeason ?? "—"}</td>
                <td className="td">{clanCount.get(se.id) ?? 0}</td>
                <td className="td">
                  {se.status === "finalized" ? (
                    <span className="chip bg-good/15 text-good">Finalized</span>
                  ) : (
                    <span className="chip bg-accent/15 text-accent">Open</span>
                  )}
                  {!se.hasCwlData && <span className="chip ml-1 bg-panel2 text-muted">History only</span>}
                </td>
              </tr>
            ))}
            {seasons.length === 0 && (
              <tr>
                <td className="td text-muted" colSpan={5}>
                  No seasons yet. Sync CWL, import a ClashPerk CWL export, or create one below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <NewSeasonForm />
    </div>
  );
}

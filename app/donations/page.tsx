import Link from "next/link";
import { donationBoard, donationSeasons } from "@/lib/live";
import { gameSeasonAt, prevMonth } from "@/lib/util";
import { DonationsTable } from "@/components/DonationsTable";
import { LiveControls } from "@/components/LiveControls";
import { saveDonationsNow } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function DonationsPage(props: PageProps<"/donations">) {
  const sp = await props.searchParams;
  const current = gameSeasonAt(new Date());
  const season = typeof sp.season === "string" && sp.season ? sp.season : current;
  const known = await donationSeasons();
  const seasons = [...new Set([current, prevMonth(current), ...known])].sort().reverse();
  const { rows, clanNames, lastUpdated } = await donationBoard(season);

  const totalDonated = rows.reduce((n, r) => n + r.donated, 0);
  const totalReceived = rows.reduce((n, r) => n + r.received, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Donations</h1>
          <p className="text-muted">
            Combined across all alliance clans. {rows.length} players · {totalDonated.toLocaleString()} donated ·{" "}
            {totalReceived.toLocaleString()} received
            {season < current && <> · season {season} has ended, so these totals are final</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {seasons.map((s) => (
            <Link
              key={s}
              href={`/donations?season=${s}`}
              className={`btn btn-sm ${s === season ? "border-accent text-accent" : ""}`}
              prefetch={false}
            >
              {s}
              {s === current && " (live)"}
            </Link>
          ))}
        </div>
      </div>

      {season === current && (
        <div className="card p-3">
          <LiveControls
            action={saveDonationsNow}
            label="Refresh from game"
            pendingText="Fetching…"
            lastUpdated={lastUpdated ? new Date(lastUpdated).toLocaleString() : null}
          />
          <p className="mt-2 text-xs text-muted">
            The daily job saves donations automatically. Use this when you want the very latest numbers, for example just before the season
            reset.
          </p>
        </div>
      )}

      <DonationsTable rows={rows} clanNames={clanNames} />
    </div>
  );
}

import Link from "next/link";
import { statsBoard, statsSeasons } from "@/lib/stats";
import { gameSeasonAt, prevMonth } from "@/lib/util";
import { StatsTable, type StatsView } from "@/components/StatsTable";
import { LiveControls } from "@/components/LiveControls";
import { refreshPlayerStats } from "@/lib/actions";
import { TrackPlayer } from "@/components/TrackPlayer";

export const dynamic = "force-dynamic";

const VIEWS: { id: StatsView; label: string }[] = [
  { id: "both", label: "Donations + Received" },
  { id: "donations", label: "Donations" },
  { id: "attacks", label: "Attacks" },
];

export default async function StatsPage(props: PageProps<"/donations">) {
  const sp = await props.searchParams;
  const current = gameSeasonAt(new Date());
  const season = typeof sp.season === "string" && sp.season ? sp.season : current;
  const view = (VIEWS.find((v) => v.id === sp.view)?.id ?? "both") as StatsView;

  const known = await statsSeasons();
  const seasons = [...new Set([current, prevMonth(current), ...known])].sort().reverse();
  const board = await statsBoard(season);
  const link = (patch: { season?: string; view?: StatsView }) =>
    `/donations?season=${patch.season ?? season}&view=${patch.view ?? view}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Season stats</h1>
          <p className="text-muted">
            Game season {season} — resets with donations, same as the legend season. {board.totals.players} players ·{" "}
            {board.totals.donated.toLocaleString()} donated · {board.totals.received.toLocaleString()} received ·{" "}
            {board.totals.attacks.toLocaleString()} attack wins
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {seasons.map((sn) => (
            <Link key={sn} href={link({ season: sn })} className={`btn btn-sm ${sn === season ? "border-accent text-accent" : ""}`} prefetch={false}>
              {sn}
              {sn === current && " (live)"}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {VIEWS.map((v) => (
          <Link key={v.id} href={link({ view: v.id })} className={`btn ${v.id === view ? "border-accent text-accent" : ""}`} prefetch={false}>
            {v.label}
          </Link>
        ))}
      </div>

      {season === current && (
        <div className="card space-y-3 p-3">
          <LiveControls
            action={refreshPlayerStats}
            label="Refresh from game"
            pendingText="Fetching players…"
            lastUpdated={board.lastUpdated ? new Date(board.lastUpdated).toLocaleString() : null}
            intervalSeconds={120}
          />
          <p className="text-xs text-muted">
            Reads every family-clan member plus tracked players, one by one, so attack wins are included. The daily job does this
            automatically; refresh here when you want the numbers right now.
          </p>
          <TrackPlayer />
        </div>
      )}

      <StatsTable rows={board.rows} clans={board.clans} view={view} />
    </div>
  );
}

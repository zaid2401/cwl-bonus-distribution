import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeason } from "@/lib/view";
import { attacksBoard, attacksOverview } from "@/lib/live";
import { AttacksGrid } from "@/components/AttacksGrid";
import { LiveControls } from "@/components/LiveControls";
import { syncAll } from "@/lib/actions";
import { tagSlug } from "@/lib/util";

export const dynamic = "force-dynamic";

export default async function AttacksPage(props: PageProps<"/seasons/[id]/attacks">) {
  const { id: raw } = await props.params;
  const sp = await props.searchParams;
  const id = decodeURIComponent(raw);
  const season = await getSeason(id);
  if (!season) notFound();

  const clans = await attacksOverview(id);
  const selected =
    typeof sp.clan === "string" ? clans.find((c) => tagSlug(c.clanTag) === sp.clan) : undefined;
  const board = clans.length ? await attacksBoard(id, (selected ?? clans[0]).clanTag) : null;

  const totals = clans.reduce(
    (a, c) => ({
      full: a.full + c.full,
      players: a.players + c.players,
      pending: a.pending + c.pending,
      missed: a.missed + c.missed,
    }),
    { full: 0, players: 0, pending: 0, missed: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/seasons/${encodeURIComponent(id)}`} className="text-muted hover:text-text">
            ← CWL {season.label}
          </Link>
          <h1 className="mt-1 text-2xl font-bold">Attacks · {season.label}</h1>
          <p className="text-muted">
            {totals.full}/{totals.players} players on 7/7 ·{" "}
            <span className="text-warn">{totals.pending} attacks still open</span> ·{" "}
            <span className="text-bad">{totals.missed} missed</span>
          </p>
        </div>
        <LiveControls
          action={syncAll}
          label="Sync all clans"
          pendingText="Syncing…"
          lastUpdated={board?.lastFetched ? new Date(board.lastFetched).toLocaleString() : null}
          intervalSeconds={300}
        />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="th">Clan</th>
              <th className="th">Rounds ended</th>
              <th className="th">On 7/7</th>
              <th className="th">Open attacks</th>
              <th className="th">Missed</th>
            </tr>
          </thead>
          <tbody>
            {clans.map((c) => (
              <tr
                key={c.clanTag}
                className={`hover:bg-panel2 ${board?.clanTag === c.clanTag ? "bg-panel2" : ""}`}
              >
                <td className="td">
                  <Link
                    href={`/seasons/${encodeURIComponent(id)}/attacks?clan=${tagSlug(c.clanTag)}`}
                    className="font-semibold text-accent hover:underline"
                  >
                    {c.clanName}
                  </Link>
                  {c.liveRound && (
                    <span className="chip ml-2 bg-warn/15 text-warn">round {c.liveRound} live</span>
                  )}
                </td>
                <td className="td">{c.roundsEnded}/7</td>
                <td className="td">
                  {c.full}/{c.players}
                </td>
                <td className="td">{c.pending ? <span className="text-warn">{c.pending}</span> : "—"}</td>
                <td className="td">{c.missed ? <span className="text-bad">{c.missed}</span> : "—"}</td>
              </tr>
            ))}
            {clans.length === 0 && (
              <tr>
                <td className="td text-muted" colSpan={5}>
                  No CWL data for this season yet. Sync first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {board && <AttacksGrid board={board} seasonId={id} />}
    </div>
  );
}

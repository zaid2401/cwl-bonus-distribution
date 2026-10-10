import Link from "next/link";
import { notFound } from "next/navigation";
import { clanBoard, getSeason } from "@/lib/view";
import { BoardTable } from "@/components/BoardTable";
import { ActionButton } from "@/components/ActionButton";
import { syncClan } from "@/lib/actions";
import { seasonGate } from "@/lib/session";
import { slugTag } from "@/lib/util";
import { B2B_THRESHOLD, B2B_WINDOW, STEAL_MARGIN } from "@/lib/logic";

export const dynamic = "force-dynamic";

export default async function ClanBoardPage(props: PageProps<"/seasons/[id]/[clan]">) {
  const { id: rawId, clan } = await props.params;
  const id = decodeURIComponent(rawId);
  const admin = await seasonGate(id);
  const season = await getSeason(id);
  if (!season) notFound();
  const board = await clanBoard(id, slugTag(clan));
  const finalized = season.status === "finalized";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/seasons/${encodeURIComponent(id)}`} className="text-muted hover:text-text">
            ← CWL {season.label}
          </Link>
          <h1 className="mt-1 text-2xl font-bold">
            {board.clanName} <span className="text-base font-normal text-muted">{board.clanTag}</span>
            {!board.active && (
              <span className="chip ml-2 bg-panel2 align-middle text-muted">not used this season</span>
            )}
          </h1>
          <p className="text-muted">
            Record <span className="text-good">{board.wins}W</span> /{" "}
            <span className="text-bad">{board.losses}L</span> / {board.ties}T ({board.roundsEnded}/7 wars
            ended) · Bonuses = 6 + wins · Donations from {season.donationSeason ?? "—"}
            {!board.donationsImported && <span className="text-warn"> (no sheet imported yet)</span>} ·
            {board.hasApiData ? " attacks from API" : " no API war data (using imported/manual attacks)"}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {admin && (
            <Link className="btn" href={`/seasons/${encodeURIComponent(id)}/attacks?clan=${clan}`}>
              Attack details
            </Link>
          )}
          {admin && !finalized && (
            <ActionButton action={syncClan.bind(null, board.clanTag)} pendingText="Syncing…">
              Sync this clan
            </ActionButton>
          )}
        </div>
      </div>

      <BoardTable
        canEdit={admin}
        seasonId={id}
        clanTag={board.clanTag}
        finalized={finalized}
        bonuses={board.bonuses}
        bonusOverride={board.bonusOverride}
        autoBonuses={6 + board.wins}
        prevSeasons={board.prevSeasons.map((p) => ({ id: p.id, label: p.label }))}
        rows={board.rows}
      />

      <div className="text-xs text-muted">
        <b>Eligible</b> = 7/7 attacks, PN1 main account, not ticked Alt, not ticked Left JPA. An <b>excuse</b>{" "}
        stands in for the attacks — nothing else — and says why. <b>B2B</b> = bonus in {B2B_THRESHOLD}+ of the
        last {B2B_WINDOW} seasons (flag only). <b>Star steal</b> = attacked a base {STEAL_MARGIN + 1}+ places
        lower after already having 8★. Numbers in gold = top donors among eligible players up to the bonus
        count (a hint only — you decide).
      </div>
    </div>
  );
}

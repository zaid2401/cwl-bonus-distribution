import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, schema as s } from "@/lib/db";
import { getSeason, seasonOverview } from "@/lib/view";
import { ActionButton } from "@/components/ActionButton";
import { SeasonSettings } from "@/components/SeasonSettings";
import { ClanSeasonToggle } from "@/components/ClanSeasonToggle";
import {
  applyRecordedBonuses,
  deleteSeason,
  exportSeasonToSheet,
  finalizeSeason,
  reopenSeason,
  syncClan,
} from "@/lib/actions";
import { tagSlug } from "@/lib/util";

export const dynamic = "force-dynamic";

export default async function SeasonPage(props: PageProps<"/seasons/[id]">) {
  const { id: raw } = await props.params;
  const id = decodeURIComponent(raw);
  const season = await getSeason(id);
  if (!season) notFound();
  const clans = await seasonOverview(id);
  const db = await getDb();
  const allClans = await db.select().from(s.clans);
  const finalized = season.status === "finalized";

  const inUse = clans.filter((c) => c.active);
  const totals = { bonuses: 0, selected: 0, eligible: 0, recorded: 0 };
  for (const c of inUse) {
    totals.bonuses += c.bonuses;
    totals.selected += c.selected;
    totals.eligible += c.eligible;
    totals.recorded += c.recorded;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-muted hover:text-text">
            ← Seasons
          </Link>
          <h1 className="mt-1 text-2xl font-bold">
            CWL {season.label}{" "}
            {finalized ? (
              <span className="chip bg-good/15 align-middle text-good">Finalized</span>
            ) : (
              <span className="chip bg-accent/15 align-middle text-accent">Open</span>
            )}
          </h1>
          <p className="text-muted">
            Donations from season <b className="text-text">{season.donationSeason ?? "—"}</b> ·{" "}
            {totals.selected}/{totals.bonuses} bonuses picked · {totals.eligible} eligible players ·{" "}
            {inUse.length} of {clans.length} clans in use
            {totals.recorded > 0 && <> · {totals.recorded} already in bonus history</>}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {totals.recorded > totals.selected && !finalized && (
            <ActionButton
              action={applyRecordedBonuses.bind(null, id)}
              confirm={`Tick the players already in bonus history for ${season.label}? One account per member.`}
              pendingText="Applying…"
            >
              Apply history to picks
            </ActionButton>
          )}
          <ActionButton action={exportSeasonToSheet.bind(null, id)} pendingText="Exporting…">
            Export to Google Sheet
          </ActionButton>
          <Link className="btn" href={`/seasons/${encodeURIComponent(id)}/attacks`}>
            Live attacks
          </Link>
          <a className="btn" href={`/api/export/${encodeURIComponent(id)}`}>
            Download CSV
          </a>
          {finalized ? (
            <ActionButton action={reopenSeason.bind(null, id)} confirm="Reopen this season for changes?">
              Reopen
            </ActionButton>
          ) : (
            <ActionButton
              action={finalizeSeason.bind(null, id)}
              className="btn btn-primary"
              confirm="Finalize? Selected players will be written to bonus history."
            >
              Finalize season
            </ActionButton>
          )}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="th" title="Clans you are actually using for CWL this season">
                In use
              </th>
              <th className="th">Clan</th>
              <th className="th">W / L / T</th>
              <th className="th">Bonuses</th>
              <th className="th">Picked</th>
              <th className="th">Eligible (7/7, main, member)</th>
              <th className="th">In history</th>
              <th className="th">Last sync</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {clans.map((c) => {
              const done = c.selected === c.bonuses;
              return (
                <tr key={c.clanTag} className={c.active ? "hover:bg-panel2" : "opacity-45 hover:opacity-100"}>
                  <td className="td">
                    <ClanSeasonToggle
                      seasonId={id}
                      clanTag={c.clanTag}
                      active={c.active}
                      disabled={finalized}
                    />
                  </td>
                  <td className="td">
                    <Link
                      href={`/seasons/${encodeURIComponent(id)}/${tagSlug(c.clanTag)}`}
                      className="font-semibold text-accent hover:underline"
                    >
                      {c.clanName}
                    </Link>
                    <div className="text-xs text-muted">{c.clanTag}</div>
                    {!c.active && <span className="chip bg-panel2 text-muted">not this season</span>}
                  </td>
                  <td className="td whitespace-nowrap">
                    <span className="text-good">{c.wins}</span> / <span className="text-bad">{c.losses}</span>{" "}
                    / {c.ties}
                    <span className="text-muted"> ({c.roundsEnded}/7)</span>
                  </td>
                  <td className="td font-semibold">
                    {c.bonuses}
                    {c.bonusOverride != null && (
                      <span className="chip ml-1 bg-panel2 text-muted">manual</span>
                    )}
                  </td>
                  <td className="td">
                    <span className={done ? "text-good" : c.selected > c.bonuses ? "text-bad" : "text-warn"}>
                      {c.selected}/{c.bonuses}
                    </span>
                  </td>
                  <td className="td">{c.eligible}</td>
                  <td className="td">{c.recorded || <span className="text-muted">—</span>}</td>
                  <td className="td text-xs text-muted">
                    {c.lastSyncedAt ? new Date(c.lastSyncedAt).toLocaleString() : "never"}
                    {c.syncMessage && (
                      <div className="max-w-64 truncate" title={c.syncMessage}>
                        {c.syncMessage}
                      </div>
                    )}
                  </td>
                  <td className="td">
                    {!finalized && (
                      <ActionButton
                        action={syncClan.bind(null, c.clanTag)}
                        className="btn btn-sm"
                        pendingText="…"
                      >
                        Sync
                      </ActionButton>
                    )}
                  </td>
                </tr>
              );
            })}
            {clans.length === 0 && (
              <tr>
                <td className="td text-muted" colSpan={9}>
                  No clans in this season yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <SeasonSettings
        season={{
          id: season.id,
          label: season.label,
          sortKey: season.sortKey,
          donationSeason: season.donationSeason,
        }}
        clans={allClans
          .filter((c) => !clans.some((x) => x.clanTag === c.tag))
          .map((c) => ({ tag: c.tag, name: c.name }))}
      />

      <div className="flex justify-end">
        <ActionButton
          action={deleteSeason.bind(null, id)}
          className="btn btn-danger btn-sm"
          confirm={`Delete season ${id} and ALL its data (wars, picks, history)? This cannot be undone.`}
        >
          Delete season
        </ActionButton>
      </div>
    </div>
  );
}

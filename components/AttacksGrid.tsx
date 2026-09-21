"use client";

import Link from "next/link";
import { useState } from "react";
import type { AttackBoard, AttackCell } from "@/lib/live";
import { tagSlug } from "@/lib/util";

function Cell({ cell }: { cell: AttackCell }) {
  if (cell.state === "out") return <span className="text-line">·</span>;
  if (cell.state === "hit")
    return (
      <span
        className={cell.stars === 3 ? "font-semibold text-good" : cell.stars ? "text-text" : "text-muted"}
        title={`${cell.stars}★ ${cell.destruction?.toFixed(0)}% · #${cell.position} hit #${cell.defenderPosition}`}
      >
        {"★".repeat(cell.stars ?? 0) || "0★"}
      </span>
    );
  if (cell.state === "prep")
    return (
      <span className="text-muted" title={`In the lineup at #${cell.position}, war has not started`}>
        prep
      </span>
    );
  if (cell.state === "pending")
    return (
      <span
        className="chip bg-warn/15 text-warn"
        title={`In the lineup at #${cell.position}, attack still open`}
      >
        open
      </span>
    );
  return (
    <span className="chip bg-bad/15 text-bad" title={`In the lineup at #${cell.position}, did not attack`}>
      miss
    </span>
  );
}

export function AttacksGrid({ board, seasonId }: { board: AttackBoard; seasonId: string }) {
  const [onlyProblems, setOnlyProblems] = useState(false);
  const rows = onlyProblems ? board.rows.filter((r) => r.pending || r.missed) : board.rows;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">
          {board.clanName} <span className="text-sm font-normal text-muted">{board.clanTag}</span>
        </h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={onlyProblems}
              onChange={(e) => setOnlyProblems(e.target.checked)}
            />
            Only open or missed
          </label>
          <Link
            href={`/seasons/${encodeURIComponent(seasonId)}/${tagSlug(board.clanTag)}`}
            className="btn btn-sm"
          >
            Bonus board →
          </Link>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="th w-10">#</th>
              <th className="th">Player</th>
              {board.rounds.map((r) => (
                <th
                  key={r.round}
                  className="th text-center"
                  title={`${r.opponentName} · ${r.ourStars}★ vs ${r.theirStars}★`}
                >
                  R{r.round}
                  <div className="font-normal">
                    {r.state === "warEnded" ? (
                      <span
                        className={
                          r.result === "win" ? "text-good" : r.result === "loss" ? "text-bad" : "text-muted"
                        }
                      >
                        {r.ourStars}–{r.theirStars}
                      </span>
                    ) : (
                      <span className="text-warn">{r.state === "preparation" ? "prep" : "live"}</span>
                    )}
                  </div>
                </th>
              ))}
              <th className="th text-right">Attacks</th>
              <th className="th text-right">Stars</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.tag} className="hover:bg-panel2">
                <td className="td text-xs text-muted">{i + 1}</td>
                <td className="td">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted">
                    {r.tag}
                    {r.townhall ? ` · TH${r.townhall}` : ""}
                  </div>
                </td>
                {r.cells.map((c, ci) => (
                  <td key={ci} className="td text-center whitespace-nowrap">
                    <Cell cell={c} />
                  </td>
                ))}
                <td className={`td text-right font-medium ${r.attacks >= 7 ? "text-good" : ""}`}>
                  {r.attacks}
                </td>
                <td className="td text-right text-muted">{r.stars}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="td text-muted" colSpan={board.rounds.length + 4}>
                  Nothing open or missed in this clan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        <span className="text-good">★</span> attack made · <span className="text-warn">open</span> = in the
        lineup, war still running · <span className="text-bad">miss</span> = war ended without attacking ·{" "}
        <span className="text-muted">prep</span> = war not started · <span className="text-line">·</span> not
        in that war
      </p>
    </div>
  );
}

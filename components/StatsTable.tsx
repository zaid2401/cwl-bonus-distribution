"use client";

import { useMemo, useState } from "react";
import type { StatRow } from "@/lib/stats";
import { setTracked } from "@/lib/actions";
import { useAction } from "./ActionButton";

export type StatsView = "both" | "donations" | "attacks";

const n = (v: number) => v.toLocaleString();
type SortKey = "donated" | "received" | "net" | "ratio" | "attackWins" | "defenseWins" | "trophies" | "name";

export function StatsTable({ rows, clans, view }: { rows: StatRow[]; clans: { tag: string; name: string }[]; view: StatsView }) {
  const [q, setQ] = useState("");
  const [clan, setClan] = useState("");
  const [sort, setSort] = useState<SortKey>(view === "attacks" ? "attackWins" : "donated");
  const { pending, exec } = useAction();

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = rows.filter(
      (r) =>
        (clan === "" || (clan === "__tracked" ? r.isTracked : r.clanTag === clan)) &&
        (!term ||
          r.name.toLowerCase().includes(term) ||
          r.tag.toLowerCase().includes(term) ||
          (r.discordUsername ?? "").toLowerCase().includes(term)),
    );
    return [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "ratio") return (b.ratio ?? Infinity) - (a.ratio ?? Infinity);
      if (sort === "trophies") return (b.trophies ?? 0) - (a.trophies ?? 0);
      return b[sort] - a[sort];
    });
  }, [rows, q, clan, sort]);

  const Header = ({ k, label, right = true }: { k: SortKey; label: string; right?: boolean }) => (
    <th className={`th cursor-pointer select-none ${right ? "text-right" : ""}`} onClick={() => setSort(k)}>
      {label} {sort === k && <span className="text-accent">▾</span>}
    </th>
  );

  const showDon = view !== "attacks";
  const showRec = view === "both";
  const showAtk = view !== "donations";

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center gap-3 p-3">
        <input className="input w-64" placeholder="Search name, tag, Discord…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={clan} onChange={(e) => setClan(e.target.value)}>
          <option value="">All clans</option>
          <option value="__tracked">Tracked players only</option>
          {clans.map((c) => (
            <option key={c.tag} value={c.tag}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted">{visible.length} shown</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="th w-10">#</th>
              <Header k="name" label="Player" right={false} />
              <th className="th">Clan</th>
              {showDon && <Header k="donated" label="Donated" />}
              {showRec && <Header k="received" label="Received" />}
              {showRec && <Header k="net" label="Net" />}
              {showRec && <Header k="ratio" label="Ratio" />}
              {showAtk && <Header k="attackWins" label="Attack wins" />}
              {view === "attacks" && <Header k="defenseWins" label="Defense wins" />}
              {view === "attacks" && <Header k="trophies" label="Trophies" />}
              <th className="th">Discord</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={r.tag} className="hover:bg-panel2">
                <td className="td text-xs text-muted">{i + 1}</td>
                <td className="td">
                  <div className="flex items-center gap-1.5 font-medium">
                    {r.name}
                    {r.isTracked && <span className="chip bg-accent/15 text-accent">tracked</span>}
                  </div>
                  <div className="text-xs text-muted">
                    {r.tag}
                    {r.townhall ? ` · TH${r.townhall}` : ""}
                  </div>
                </td>
                <td className="td text-xs">
                  {r.clanName ?? <span className="text-muted">—</span>}
                  {r.clanName && !r.inFamilyClan && <span className="chip ml-1 bg-panel2 text-muted">outside</span>}
                </td>
                {showDon && <td className="td text-right font-medium tabular-nums text-good">{n(r.donated)}</td>}
                {showRec && <td className="td text-right tabular-nums text-muted">{n(r.received)}</td>}
                {showRec && (
                  <td className={`td text-right tabular-nums ${r.net >= 0 ? "text-good" : "text-bad"}`}>
                    {r.net > 0 ? "+" : ""}
                    {n(r.net)}
                  </td>
                )}
                {showRec && <td className="td text-right tabular-nums">{r.ratio == null ? "—" : r.ratio.toFixed(2)}</td>}
                {showAtk && <td className="td text-right font-medium tabular-nums">{n(r.attackWins)}</td>}
                {view === "attacks" && <td className="td text-right tabular-nums text-muted">{n(r.defenseWins)}</td>}
                {view === "attacks" && <td className="td text-right tabular-nums text-muted">{r.trophies == null ? "—" : n(r.trophies)}</td>}
                <td className="td text-xs">
                  {r.discordUsername ?? <span className="text-muted">—</span>}
                  {!r.discordId && <span className="chip ml-1 bg-bad/15 text-bad">no ID</span>}
                </td>
                <td className="td text-right">
                  {!r.inFamilyClan && (
                    <button
                      className="btn btn-sm"
                      disabled={pending}
                      title={r.isTracked ? "Stop following this player" : "Follow this player's season stats"}
                      onClick={() => exec(() => setTracked(r.tag, !r.isTracked))}
                    >
                      {r.isTracked ? "Untrack" : "Track"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td className="td text-muted" colSpan={11}>
                  No data for this season yet. Click “Refresh from game”, or wait for the daily job.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {view !== "attacks" && (
        <p className="text-xs text-muted">Attack wins are only recorded from the moment player tracking runs — older seasons show donations only.</p>
      )}
    </div>
  );
}

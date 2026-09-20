"use client";

import { useMemo, useState } from "react";
import type { DonationRow } from "@/lib/live";

const n = (v: number) => v.toLocaleString();
type SortKey = "donated" | "received" | "ratio" | "name";

export function DonationsTable({ rows, clanNames }: { rows: DonationRow[]; clanNames: [string, string][] }) {
  const [q, setQ] = useState("");
  const [clan, setClan] = useState("");
  const [sort, setSort] = useState<SortKey>("donated");
  const names = useMemo(() => new Map(clanNames), [clanNames]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = rows.filter(
      (r) =>
        (!clan || r.clans.includes(clan)) &&
        (!term ||
          r.name.toLowerCase().includes(term) ||
          r.tag.toLowerCase().includes(term) ||
          (r.discordUsername ?? "").toLowerCase().includes(term)),
    );
    return [...list].sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "ratio"
          ? (b.ratio ?? Infinity) - (a.ratio ?? Infinity)
          : b[sort] - a[sort],
    );
  }, [rows, q, clan, sort]);

  const Header = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th className={`th cursor-pointer select-none ${right ? "text-right" : ""}`} onClick={() => setSort(k)}>
      {label} {sort === k && <span className="text-accent">▾</span>}
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center gap-3 p-3">
        <input className="input w-64" placeholder="Search name, tag, Discord…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={clan} onChange={(e) => setClan(e.target.value)}>
          <option value="">All clans</option>
          {clanNames.map(([tag, name]) => (
            <option key={tag} value={tag}>
              {name}
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
              <Header k="name" label="Player" />
              <th className="th">Clan</th>
              <Header k="donated" label="Donated" right />
              <Header k="received" label="Received" right />
              <Header k="ratio" label="Ratio" right />
              <th className="th">Discord</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={r.tag} className="hover:bg-panel2">
                <td className="td text-xs text-muted">{i + 1}</td>
                <td className="td">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted">{r.tag}</div>
                </td>
                <td className="td text-xs text-muted">
                  {r.imported ? <span className="chip bg-panel2 text-muted">imported</span> : r.clans.map((c) => names.get(c) ?? c).join(", ") || "—"}
                </td>
                <td className="td text-right font-medium tabular-nums text-good">{n(r.donated)}</td>
                <td className="td text-right tabular-nums text-muted">{n(r.received)}</td>
                <td className="td text-right tabular-nums">{r.ratio == null ? "—" : r.ratio.toFixed(2)}</td>
                <td className="td text-xs">
                  {r.discordUsername ?? <span className="text-muted">—</span>}
                  {!r.discordId && <span className="chip ml-1 bg-bad/15 text-bad">no ID</span>}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td className="td text-muted" colSpan={7}>
                  No donation data for this season yet. Click “Refresh from game”, or import a ClashPerk season export.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

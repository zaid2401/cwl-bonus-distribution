"use client";

import { useState } from "react";
import { doImportCwl, doImportDonations, doImportHistory, doImportPlayers, previewSheet } from "@/lib/actions";
import { gameSeasonAt, guessSeasonFromHeader, seasonLabel } from "@/lib/util";
import { Result, useAction } from "./ActionButton";

type Tab = "history" | "donations" | "cwl" | "players";

export function ImportTabs(props: { clans: { tag: string; name: string }[]; seasons: { id: string; label: string }[]; defaultDonationSeason: string }) {
  const [tab, setTab] = useState<Tab>("history");
  const tabs: { id: Tab; label: string }[] = [
    { id: "history", label: "Bonus history" },
    { id: "donations", label: "Donations (ClashPerk /export season)" },
    { id: "cwl", label: "CWL attacks (ClashPerk /export cwl)" },
    { id: "players", label: "Player links / PN" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {tabs.map((t) => (
          <button key={t.id} className={`btn ${tab === t.id ? "border-accent text-accent" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "history" && <HistoryImport />}
      {tab === "donations" && <DonationsImport defaultSeason={props.defaultDonationSeason} />}
      {tab === "cwl" && <CwlImport clans={props.clans} seasons={props.seasons} />}
      {tab === "players" && <PlayersImport />}
    </div>
  );
}

function Source({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">Google Sheet link or CSV text</label>
      <textarea
        className="input h-20 w-full font-mono text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://docs.google.com/spreadsheets/d/…/edit#gid=0"
      />
    </div>
  );
}

function HistoryImport() {
  const [src, setSrc] = useState("");
  const [header, setHeader] = useState<string[] | null>(null);
  const [total, setTotal] = useState(0);
  const [idCol, setIdCol] = useState(0);
  const [cols, setCols] = useState<{ index: number; on: boolean; seasonId: string; label: string; sortKey: string }[]>([]);
  const { pending, result, setResult, exec } = useAction();

  const load = () =>
    exec(async () => {
      const r = await previewSheet(src);
      if (!r.ok) return { ok: false, message: r.message };
      setHeader(r.header);
      setTotal(r.total);
      const id = Math.max(0, r.header.findIndex((h) => /^(discord )?id$/i.test(h.trim())));
      setIdCol(id);
      const seen = new Map<string, number>();
      const current = gameSeasonAt(new Date());
      setCols(
        r.header.map((h, index) => {
          const g = guessSeasonFromHeader(h);
          let seasonId = g?.id ?? "";
          let sortKey = g?.sortKey ?? "";
          if (g) {
            // Several events in one month: 2026-06, 2026-06-2 … with increasing order dates.
            const c = (seen.get(g.id) ?? 0) + 1;
            seen.set(g.id, c);
            if (c > 1) {
              seasonId = `${g.id}-${c}`;
              sortKey = `${g.id}-${String(Math.max(c, Number(g.sortKey.slice(8)))).padStart(2, "0")}`;
            }
          }
          // The current month is the season being decided in the app — don't import it as history by default.
          return { index, on: Boolean(g) && index !== id && g!.id < current, seasonId, label: g ? seasonLabel(seasonId) : h.trim(), sortKey };
        }),
      );
      return { ok: true, message: `Loaded ${r.total} rows. Check the season mapping below.` };
    });

  const set = (i: number, patch: Partial<(typeof cols)[number]>) => setCols(cols.map((c) => (c.index === i ? { ...c, ...patch } : c)));

  return (
    <div className="card space-y-3 p-4">
      <p className="text-muted">
        One row per member: a <b>Discord ID</b> column (or player tag starting with #) and one TRUE/FALSE column per season — like your <code>DB</code> tab.
        Re-importing a season replaces its imported marks. For two events in one month use ids like <code>2026-06</code> and <code>2026-06-2</code> with
        different order dates.
      </p>
      <Source value={src} onChange={(v) => (setSrc(v), setHeader(null), setResult(null))} />
      <button className="btn" disabled={pending || !src.trim()} onClick={load}>
        Load columns
      </button>
      {header && (
        <>
          <div className="flex items-center gap-2">
            <label className="label mb-0">ID column</label>
            <select className="input" value={idCol} onChange={(e) => setIdCol(Number(e.target.value))}>
              {header.map((h, i) => (
                <option key={i} value={i}>
                  {h || `Column ${i + 1}`}
                </option>
              ))}
            </select>
            <span className="text-sm text-muted">{total} rows</span>
          </div>
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="th">Import</th>
                <th className="th">Sheet column</th>
                <th className="th">Season id</th>
                <th className="th">Label</th>
                <th className="th">Order date</th>
              </tr>
            </thead>
            <tbody>
              {cols
                .filter((c) => c.index !== idCol)
                .map((c) => (
                  <tr key={c.index}>
                    <td className="td">
                      <input type="checkbox" checked={c.on} onChange={(e) => set(c.index, { on: e.target.checked })} />
                    </td>
                    <td className="td">{header[c.index] || `Column ${c.index + 1}`}</td>
                    <td className="td">
                      <input className="input w-32 py-1" value={c.seasonId} onChange={(e) => set(c.index, { seasonId: e.target.value })} placeholder="2026-05" />
                    </td>
                    <td className="td">
                      <input className="input w-32 py-1" value={c.label} onChange={(e) => set(c.index, { label: e.target.value })} />
                    </td>
                    <td className="td">
                      <input className="input w-32 py-1" value={c.sortKey} onChange={(e) => set(c.index, { sortKey: e.target.value })} placeholder="2026-05-01" />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <button
            className="btn btn-primary"
            disabled={pending || !cols.some((c) => c.on)}
            onClick={() => {
              const chosen = cols.filter((c) => c.on && c.index !== idCol);
              const bad = chosen.find((c) => !c.seasonId || !/^\d{4}-\d{2}-\d{2}$/.test(c.sortKey));
              if (bad) return setResult({ ok: false, message: `Column “${header[bad.index]}” needs a season id and an order date (YYYY-MM-DD).` });
              exec(() => doImportHistory(src, idCol, chosen.map(({ index, seasonId, label, sortKey }) => ({ index, seasonId, label, sortKey }))));
            }}
          >
            Import history
          </button>
        </>
      )}
      <Result result={result} />
    </div>
  );
}

function DonationsImport({ defaultSeason }: { defaultSeason: string }) {
  const [src, setSrc] = useState("");
  const [season, setSeason] = useState(defaultSeason);
  const [links, setLinks] = useState(true);
  const { pending, result, exec } = useAction();
  return (
    <div className="card space-y-3 p-4">
      <p className="text-muted">
        Needs <b>Tag</b> and <b>Total Donated</b> columns (optional: Total Received, Name, Username, ID). Imported totals replace API snapshots for that
        season.
      </p>
      <Source value={src} onChange={setSrc} />
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Donation season</label>
          <input className="input w-32" value={season} onChange={(e) => setSeason(e.target.value)} placeholder="2026-08" />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={links} onChange={(e) => setLinks(e.target.checked)} /> Fill missing Discord links from Username / ID columns
        </label>
        <button className="btn btn-primary" disabled={pending || !src.trim()} onClick={() => exec(() => doImportDonations(src, season, links))}>
          {pending ? "Importing…" : "Import donations"}
        </button>
      </div>
      <Result result={result} />
    </div>
  );
}

function CwlImport({ clans, seasons }: { clans: { tag: string; name: string }[]; seasons: { id: string; label: string }[] }) {
  const [src, setSrc] = useState("");
  const [season, setSeason] = useState(seasons[0]?.id ?? "");
  const [clan, setClan] = useState("");
  const { pending, result, exec } = useAction();
  return (
    <div className="card space-y-3 p-4">
      <p className="text-muted">
        Fallback when the API no longer has the war data. Needs <b>Tag</b> and <b>Number of Attacks</b> columns. Import one clan&apos;s export at a time.
      </p>
      <Source value={src} onChange={setSrc} />
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Season id</label>
          <input className="input w-32" list="season-ids" value={season} onChange={(e) => setSeason(e.target.value)} placeholder="2026-09" />
          <datalist id="season-ids">
            {seasons.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </datalist>
        </div>
        <div>
          <label className="label">Clan</label>
          <select className="input" value={clan} onChange={(e) => setClan(e.target.value)}>
            <option value="">Choose clan…</option>
            {clans.map((c) => (
              <option key={c.tag} value={c.tag}>
                {c.name || c.tag} ({c.tag})
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" disabled={pending || !src.trim() || !clan || !season} onClick={() => exec(() => doImportCwl(src, season, clan))}>
          {pending ? "Importing…" : "Import CWL export"}
        </button>
      </div>
      <Result result={result} />
    </div>
  );
}

function PlayersImport() {
  const [src, setSrc] = useState("");
  const { pending, result, exec } = useAction();
  return (
    <div className="card space-y-3 p-4">
      <p className="text-muted">
        Needs a <b>Tag</b> column. Optional: Name, ID (Discord ID), Username, PN (e.g. “PN2” or “2”), Guest (TRUE/FALSE). Non-empty cells overwrite
        existing values.
      </p>
      <Source value={src} onChange={setSrc} />
      <button className="btn btn-primary" disabled={pending || !src.trim()} onClick={() => exec(() => doImportPlayers(src))}>
        {pending ? "Importing…" : "Import players"}
      </button>
      <Result result={result} />
    </div>
  );
}

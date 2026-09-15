"use client";

import { Fragment, useMemo, useState } from "react";
import type { BoardRow } from "@/lib/view";
import { addPlayerToBoard, savePlayer, setBonusOverride, updateParticipant } from "@/lib/actions";
import { Result, useAction } from "./ActionButton";

const n = (v: number) => v.toLocaleString();

export function BoardTable(props: {
  seasonId: string;
  clanTag: string;
  finalized: boolean;
  bonuses: number;
  bonusOverride: number | null;
  autoBonuses: number;
  prevSeasons: { id: string; label: string }[];
  rows: BoardRow[];
}) {
  const { seasonId, clanTag, finalized, rows } = props;
  const { pending, result, exec } = useAction();
  const [filter, setFilter] = useState<"all" | "eligible" | "selected">("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const picked = rows.filter((r) => r.selected).length;
  const hintRank = useMemo(() => {
    const m = new Map<string, number>();
    rows.filter((r) => r.eligible).forEach((r, i) => i < props.bonuses && m.set(r.tag, i + 1));
    return m;
  }, [rows, props.bonuses]);

  const visible = rows.filter(
    (r) =>
      (filter === "all" || (filter === "eligible" ? r.eligible : r.selected)) &&
      (!q || r.name.toLowerCase().includes(q.toLowerCase()) || r.tag.includes(q.toUpperCase()) || (r.discordUsername ?? "").toLowerCase().includes(q.toLowerCase())),
  );
  const history = [...props.prevSeasons].reverse(); // oldest → newest

  const part = (tag: string, patch: Parameters<typeof updateParticipant>[3]) => exec(() => updateParticipant(seasonId, clanTag, tag, patch));

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center gap-4 p-3">
        <div className="text-lg">
          Picked{" "}
          <b className={picked === props.bonuses ? "text-good" : picked > props.bonuses ? "text-bad" : "text-warn"}>
            {picked} / {props.bonuses}
          </b>
        </div>
        <BonusCount {...props} />
        <div className="flex gap-1">
          {(["all", "eligible", "selected"] as const).map((f) => (
            <button key={f} className={`btn btn-sm ${filter === f ? "border-accent text-accent" : ""}`} onClick={() => setFilter(f)}>
              {f === "all" ? `All (${rows.length})` : f === "eligible" ? `Eligible (${rows.filter((r) => r.eligible).length})` : `Picked (${picked})`}
            </button>
          ))}
        </div>
        <input className="input w-48" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="ml-auto flex items-center gap-3">
          {pending && <span className="text-xs text-muted">Saving…</span>}
          <Result result={result && !result.ok ? result : null} />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="th w-8">#</th>
              <th className="th">Bonus</th>
              <th className="th">Player</th>
              <th className="th text-right">Attacks</th>
              <th className="th text-right">Donated</th>
              <th className="th text-right">Received</th>
              <th className="th">Discord</th>
              <th className="th">PN</th>
              <th className="th">Guest</th>
              <th className="th" title="Oldest → newest">
                History
              </th>
              <th className="th">Flags</th>
              <th className="th">Transfer to</th>
              <th className="th">Remark</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <Fragment key={r.tag}>
                <tr className={r.selected ? "bg-accent/10" : r.eligible ? "" : "opacity-60 hover:opacity-100"}>
                  <td className="td text-xs">
                    {hintRank.has(r.tag) ? <span className="font-bold text-accent">{hintRank.get(r.tag)}</span> : <span className="text-muted">{i + 1}</span>}
                  </td>
                  <td className="td">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--color-accent)]"
                      checked={r.selected}
                      disabled={finalized}
                      onChange={(e) => part(r.tag, { selected: e.target.checked })}
                    />
                  </td>
                  <td className="td">
                    <div className="flex items-center gap-1.5 font-medium">
                      {r.name}
                      {r.eligible && <span className="chip bg-good/15 text-good">eligible</span>}
                    </div>
                    <div className="text-xs text-muted">
                      {r.tag}
                      {r.townhall ? ` · TH${r.townhall}` : ""}
                      {r.stars ? ` · ${r.stars}★` : ""}
                    </div>
                  </td>
                  <td className="td text-right">
                    <NumCell
                      value={r.attacks}
                      overridden={r.attacksOverride != null}
                      good={r.attacks >= 7}
                      title={`API: ${r.apiAttacks ?? "—"} · Imported: ${r.importedAttacks ?? "—"} · Source: ${r.attacksSource}`}
                      onSave={(v) => part(r.tag, { attacksOverride: v })}
                    />
                  </td>
                  <td className="td text-right">
                    <NumCell value={r.donated} overridden={r.donationsOverride != null} format onSave={(v) => part(r.tag, { donationsOverride: v })} />
                  </td>
                  <td className="td text-right text-muted">{n(r.received)}</td>
                  <td className="td">
                    <button className="text-left hover:text-accent" onClick={() => setEditing(editing === r.tag ? null : r.tag)}>
                      {r.discordUsername || r.discordId ? (
                        <>
                          <div>{r.discordUsername ?? "—"}</div>
                          <div className="text-xs text-muted">{r.discordId ?? "no ID"}</div>
                        </>
                      ) : (
                        <span className="chip bg-bad/15 text-bad">link…</span>
                      )}
                    </button>
                  </td>
                  <td className="td">
                    <PnCell value={r.pn} onSave={(pn) => exec(() => savePlayer({ tag: r.tag, pn }))} />
                  </td>
                  <td className="td">
                    <input type="checkbox" className="size-4" checked={r.isGuest} onChange={(e) => exec(() => savePlayer({ tag: r.tag, isGuest: e.target.checked }))} />
                  </td>
                  <td className="td">
                    <div className="flex gap-0.5">
                      {history.map((h, hi) => {
                        const got = r.history[r.history.length - 1 - hi];
                        return (
                          <span
                            key={h.id}
                            title={`${h.label}: ${got ? "bonus" : "no bonus"}`}
                            className={`inline-block size-3 rounded-sm ${got ? "bg-accent" : "bg-line"}`}
                          />
                        );
                      })}
                      {history.length === 0 && <span className="text-xs text-muted">—</span>}
                    </div>
                  </td>
                  <td className="td">
                    <div className="flex flex-wrap gap-1">
                      {r.backToBack && <span className="chip bg-warn/15 text-warn" title={`${r.recentBonuses} bonuses in last ${history.length} seasons`}>B2B {r.recentBonuses}</span>}
                      {r.starSteal.length > 0 && (
                        <span
                          className="chip bg-bad/15 text-bad"
                          title={r.starSteal.map((f) => `Round ${f.round}: #${f.attackerPosition} hit #${f.defenderPosition} (${f.stars}★, had ${f.starsBefore}★)`).join("\n")}
                        >
                          Star steal ×{r.starSteal.length}
                        </span>
                      )}
                      {r.isAlt && <span className="chip bg-panel2 text-muted">alt</span>}
                      {r.isGuest && <span className="chip bg-panel2 text-muted">guest</span>}
                      {r.attacks < 7 && <span className="chip bg-panel2 text-muted">{r.attacks}/7</span>}
                      {r.selectedElsewhere && <span className="chip bg-bad/15 text-bad" title={`Also picked in ${r.selectedElsewhere}`}>picked elsewhere</span>}
                    </div>
                  </td>
                  <td className="td">
                    {r.selected && r.otherAccounts.length > 0 ? (
                      <select
                        className="input py-1 text-xs"
                        value={r.transferToTag ?? ""}
                        disabled={finalized}
                        onChange={(e) => part(r.tag, { transferToTag: e.target.value || null })}
                      >
                        <option value="">— main —</option>
                        {r.otherAccounts.map((o) => (
                          <option key={o.tag} value={o.tag}>
                            {o.name} ({o.tag})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="td">
                    <TextCell value={r.remark ?? ""} onSave={(v) => part(r.tag, { remark: v || null })} />
                  </td>
                </tr>
                {editing === r.tag && (
                  <tr>
                    <td className="td bg-panel2" colSpan={13}>
                      <LinkEditor row={r} onClose={() => setEditing(null)} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <AddPlayer seasonId={seasonId} clanTag={clanTag} />
    </div>
  );
}

function BonusCount({ seasonId, clanTag, bonusOverride, autoBonuses }: { seasonId: string; clanTag: string; bonusOverride: number | null; autoBonuses: number }) {
  const { exec } = useAction();
  const [val, setVal] = useState(bonusOverride?.toString() ?? "");
  return (
    <div className="flex items-center gap-2 text-sm text-muted">
      Bonus count
      <input
        className="input w-16 py-1"
        placeholder={String(autoBonuses)}
        value={val}
        onChange={(e) => setVal(e.target.value.replace(/\D/g, ""))}
        onBlur={() => {
          const v = val === "" ? null : Number(val);
          if (v !== bonusOverride) exec(() => setBonusOverride(seasonId, clanTag, v));
        }}
        title="Leave empty for automatic (6 + wins)"
      />
      {bonusOverride != null && <span className="text-xs">(auto {autoBonuses})</span>}
    </div>
  );
}

function NumCell({
  value,
  overridden,
  onSave,
  good,
  title,
  format,
}: {
  value: number;
  overridden: boolean;
  onSave: (v: number | null) => void;
  good?: boolean;
  title?: string;
  format?: boolean;
}) {
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState("");
  if (edit)
    return (
      <input
        autoFocus
        className="input w-20 py-0.5 text-right"
        value={val}
        placeholder="auto"
        onChange={(e) => setVal(e.target.value.replace(/[^\d]/g, ""))}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        onBlur={() => {
          setEdit(false);
          onSave(val === "" ? null : Number(val));
        }}
      />
    );
  return (
    <button
      title={(title ? title + "\n" : "") + "Click to override (empty = automatic)"}
      className={`rounded px-1 tabular-nums hover:bg-panel2 ${good === undefined ? "" : good ? "text-good" : "text-bad"} ${overridden ? "underline decoration-dotted" : ""}`}
      onClick={() => {
        setVal(overridden ? String(value) : "");
        setEdit(true);
      }}
    >
      {format ? n(value) : value}
      {overridden && <sup className="text-accent">✎</sup>}
    </button>
  );
}

function PnCell({ value, onSave }: { value: number | null; onSave: (v: number | null) => void }) {
  const [val, setVal] = useState(value?.toString() ?? "");
  return (
    <input
      className={`input w-12 py-0.5 text-center ${value != null && value >= 2 ? "text-muted" : ""}`}
      value={val}
      onChange={(e) => setVal(e.target.value.replace(/\D/g, ""))}
      onBlur={() => {
        const v = val === "" ? null : Number(val);
        if (v !== value) onSave(v);
      }}
    />
  );
}

function TextCell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [val, setVal] = useState(value);
  return (
    <input
      className="input w-36 py-0.5 text-xs"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => val !== value && onSave(val.trim())}
    />
  );
}

function LinkEditor({ row, onClose }: { row: BoardRow; onClose: () => void }) {
  const [discordId, setId] = useState(row.discordId ?? "");
  const [username, setUser] = useState(row.discordUsername ?? "");
  const { pending, result, exec } = useAction();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="text-sm font-medium">
        Link {row.name} <span className="text-muted">{row.tag}</span>
      </div>
      <div>
        <label className="label">Discord ID</label>
        <input className="input w-52" value={discordId} onChange={(e) => setId(e.target.value.trim())} placeholder="437304427456495618" />
      </div>
      <div>
        <label className="label">Discord username</label>
        <input className="input w-44" value={username} onChange={(e) => setUser(e.target.value)} />
      </div>
      <button
        className="btn btn-primary"
        disabled={pending}
        onClick={() => exec(() => savePlayer({ tag: row.tag, discordId, discordUsername: username }), (r) => r.ok && onClose())}
      >
        Save
      </button>
      <button className="btn" onClick={onClose}>
        Cancel
      </button>
      <Result result={result} />
    </div>
  );
}

function AddPlayer({ seasonId, clanTag }: { seasonId: string; clanTag: string }) {
  const [tag, setTag] = useState("");
  const [name, setName] = useState("");
  const { pending, result, exec } = useAction();
  return (
    <details className="card p-3">
      <summary className="cursor-pointer text-sm font-semibold">Add a player to this clan manually</summary>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <label className="label">Player tag</label>
          <input className="input" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="#ABC123" />
        </div>
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button
          className="btn btn-primary"
          disabled={pending || !tag}
          onClick={() => exec(() => addPlayerToBoard(seasonId, clanTag, tag, name), (r) => r.ok && (setTag(""), setName("")))}
        >
          Add
        </button>
        <Result result={result} />
      </div>
    </details>
  );
}

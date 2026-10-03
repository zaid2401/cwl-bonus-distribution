"use client";

import { Fragment, useMemo, useState } from "react";
import type { BoardRow } from "@/lib/view";
import { REQUIRED_ATTACKS } from "@/lib/logic";
import { addPlayerToBoard, savePlayer, setBonusOverride, updateParticipant } from "@/lib/actions";
import { Result, useAction } from "./ActionButton";

function num(value: number) {
  return value.toLocaleString();
}

function rowClass(row: BoardRow) {
  if (row.selected) return "bg-accent/10";
  if (row.eligible) return "";
  return "opacity-60 hover:opacity-100";
}

function pickedClass(picked: number, bonuses: number) {
  if (picked === bonuses) return "text-good";
  return picked > bonuses ? "text-bad" : "text-warn";
}

type Filter = "all" | "eligible" | "selected" | "recorded";

// Everything the row shows, in one lowercase string, so the box matches any column:
// numbers with or without their commas, tags, Discord names, flags.
function searchText(r: BoardRow) {
  const bits = [
    r.name,
    r.tag,
    r.townhall && `th${r.townhall}`,
    r.attacks,
    `${r.attacks}/${REQUIRED_ATTACKS}`,
    r.stars && `${r.stars} stars`,
    r.donated,
    r.donated != null && num(r.donated),
    r.received,
    r.received != null && num(r.received),
    r.discordUsername,
    r.discordId,
    r.pn != null && `pn${r.pn}`,
    r.eligible && "eligible",
    r.selected && "picked bonus",
    r.recorded && "in history",
    r.backToBack && `b2b ${r.recentBonuses}`,
    r.starSteal.length > 0 && "star steal",
    r.isAlt && "pn2+",
    r.isAltAccount && "alt",
    r.leftJpa && "left jpa",
    r.selectedElsewhere && `picked elsewhere ${r.selectedElsewhere}`,
  ];
  return bits.filter(Boolean).join(" ").toLowerCase();
}

export function BoardTable(props: {
  canEdit: boolean;
  seasonId: string;
  clanTag: string;
  finalized: boolean;
  bonuses: number;
  bonusOverride: number | null;
  autoBonuses: number;
  prevSeasons: { id: string; label: string }[];
  rows: BoardRow[];
}) {
  const { canEdit, seasonId, clanTag, finalized, rows } = props;
  // The bonus leader reads the flags instead of the columns that set them.
  const columns = canEdit ? 12 : 9;
  const { pending, result, exec } = useAction();
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const picked = rows.filter((r) => r.selected).length;
  const recorded = rows.filter((r) => r.recorded).length;
  const haystack = useMemo(() => new Map(rows.map((r) => [r.tag, searchText(r)])), [rows]);
  const hintRank = useMemo(() => {
    const m = new Map<string, number>();
    rows.filter((r) => r.eligible).forEach((r, i) => i < props.bonuses && m.set(r.tag, i + 1));
    return m;
  }, [rows, props.bonuses]);

  function matchesFilter(r: BoardRow) {
    if (filter === "eligible") return r.eligible;
    if (filter === "recorded") return r.recorded;
    if (filter === "selected") return r.selected;
    return true;
  }

  // Several words all have to match, which is how you narrow 50 players down to one.
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);

  function matchesSearch(r: BoardRow) {
    if (!terms.length) return true;
    const text = haystack.get(r.tag) ?? "";
    return terms.every((t) => text.includes(t));
  }

  const visible = rows.filter((r) => matchesFilter(r) && matchesSearch(r));

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: rows.length },
    { id: "eligible", label: "Eligible", count: rows.filter((r) => r.eligible).length },
    { id: "selected", label: "Picked", count: picked },
  ];
  if (recorded) filters.push({ id: "recorded", label: "In history", count: recorded });
  const history = [...props.prevSeasons].reverse(); // oldest → newest

  const part = (tag: string, patch: Parameters<typeof updateParticipant>[3]) =>
    exec(() => updateParticipant(seasonId, clanTag, tag, patch));

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center gap-4 p-3">
        <div className="text-lg">
          Picked{" "}
          <b className={pickedClass(picked, props.bonuses)}>
            {picked} / {props.bonuses}
          </b>
        </div>
        <BonusCount {...props} />
        <div className="flex gap-1">
          {filters.map(({ id, label, count }) => (
            <button
              key={id}
              className={`btn btn-sm ${filter === id ? "border-accent text-accent" : ""}`}
              onClick={() => setFilter(id)}
            >
              {label} ({count})
            </button>
          ))}
        </div>
        <input
          className="input w-48"
          placeholder="Search anything…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="ml-auto flex items-center gap-3">
          {!canEdit && (
            <span className="text-xs text-muted">
              Read-only — the Bonus box is the only thing you can change.
            </span>
          )}
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
              {canEdit && (
                <>
                  <th className="th">PN</th>
                  <th className="th">Alt</th>
                  <th className="th" title="Left the alliance — no bonus">
                    Left JPA
                  </th>
                </>
              )}
              <th className="th" title="Oldest → newest">
                History
              </th>
              <th className="th">Flags</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <Fragment key={r.tag}>
                <tr className={rowClass(r)}>
                  <td className="td text-xs">
                    {hintRank.has(r.tag) ? (
                      <span className="font-bold text-accent">{hintRank.get(r.tag)}</span>
                    ) : (
                      <span className="text-muted">{i + 1}</span>
                    )}
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
                      readOnly={!canEdit}
                      value={r.attacks}
                      overridden={r.attacksOverride != null}
                      good={r.attacks >= 7}
                      title={`API: ${r.apiAttacks ?? "—"} · Imported: ${r.importedAttacks ?? "—"} · Source: ${r.attacksSource}`}
                      onSave={(v) => part(r.tag, { attacksOverride: v })}
                    />
                  </td>
                  <td className="td text-right">
                    <NumCell
                      readOnly={!canEdit}
                      value={r.donated}
                      overridden={r.donationsOverride != null}
                      format
                      onSave={(v) => part(r.tag, { donationsOverride: v })}
                    />
                  </td>
                  <td className="td text-right text-muted">{r.received == null ? "—" : num(r.received)}</td>
                  <td className="td">
                    <DiscordCell
                      row={r}
                      canEdit={canEdit}
                      onOpen={() => setEditing(editing === r.tag ? null : r.tag)}
                    />
                  </td>
                  {canEdit && (
                    <>
                      <td className="td">
                        <PnCell value={r.pn} onSave={(pn) => part(r.tag, { pn })} />
                      </td>
                      <td className="td">
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={r.isAltAccount}
                          onChange={(e) =>
                            exec(() => savePlayer({ tag: r.tag, isAltAccount: e.target.checked }))
                          }
                        />
                      </td>
                      <td className="td">
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={r.leftJpa}
                          onChange={(e) => part(r.tag, { leftJpa: e.target.checked })}
                        />
                      </td>
                    </>
                  )}
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
                    <Flags row={r} seasons={history.length} />
                  </td>
                </tr>
                {editing === r.tag && (
                  <tr>
                    <td className="td bg-panel2" colSpan={columns}>
                      <LinkEditor row={r} onClose={() => setEditing(null)} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && <AddPlayer seasonId={seasonId} clanTag={clanTag} />}
    </div>
  );
}

function BonusCount({
  canEdit,
  seasonId,
  clanTag,
  bonusOverride,
  autoBonuses,
  bonuses,
}: {
  canEdit: boolean;
  seasonId: string;
  clanTag: string;
  bonusOverride: number | null;
  autoBonuses: number;
  bonuses: number;
}) {
  const { exec } = useAction();
  const [val, setVal] = useState(bonusOverride?.toString() ?? "");
  if (!canEdit)
    return (
      <div className="text-sm text-muted">
        Bonus count <b className="text-text">{bonuses}</b>
      </div>
    );
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
  readOnly,
}: {
  value: number | null;
  overridden: boolean;
  onSave: (v: number | null) => void;
  good?: boolean;
  title?: string;
  format?: boolean;
  readOnly?: boolean;
}) {
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState("");
  const shown = value == null ? "—" : format ? num(value) : value;
  if (readOnly)
    return (
      <span
        title={title}
        className={`px-1 tabular-nums ${good === undefined ? "" : good ? "text-good" : "text-bad"}`}
      >
        {shown}
      </span>
    );
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
      {shown}
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

// Worst news first: a disqualifier, then something to look at, then plain facts. Each
// flag carries its own dot and border so a row of four still reads as four things.
function Flags({ row, seasons }: { row: BoardRow; seasons: number }) {
  const flags: { key: string; label: string; tone: string; title?: string }[] = [];
  if (row.leftJpa) flags.push({ key: "left", label: "left JPA", tone: "bad" });
  if (row.selectedElsewhere)
    flags.push({
      key: "elsewhere",
      label: "picked elsewhere",
      tone: "bad",
      title: `Also picked in ${row.selectedElsewhere}`,
    });
  if (row.starSteal.length > 0)
    flags.push({
      key: "steal",
      label: `star steal ×${row.starSteal.length}`,
      tone: "bad",
      title: row.starSteal
        .map(
          (f) =>
            `Round ${f.round}: #${f.attackerPosition} hit #${f.defenderPosition} (${f.stars}★, had ${f.starsBefore}★)`,
        )
        .join("\n"),
    });
  if (row.attacks < REQUIRED_ATTACKS)
    flags.push({
      key: "attacks",
      label: `${row.attacks}/${REQUIRED_ATTACKS} attacks`,
      tone: "warn",
      title: "Short of a full set of attacks",
    });
  if (row.backToBack)
    flags.push({
      key: "b2b",
      label: `B2B ${row.recentBonuses}`,
      tone: "warn",
      title: `${row.recentBonuses} bonuses in the last ${seasons} seasons`,
    });
  if (row.isAltAccount) flags.push({ key: "alt", label: "alt", tone: "mute" });
  if (row.isAlt) flags.push({ key: "pn", label: `PN${row.pn}`, tone: "mute", title: "Not their main" });
  if (row.recorded)
    flags.push({
      key: "history",
      label: "in history",
      tone: "good",
      title: "Already recorded in bonus history for this season",
    });

  if (!flags.length) return <span className="text-xs text-muted">—</span>;
  return (
    <div className="flex min-w-40 flex-wrap gap-1">
      {flags.map((f) => (
        <span key={f.key} className={`flag flag-${f.tone}`} title={f.title}>
          {f.label}
        </span>
      ))}
    </div>
  );
}

function DiscordCell({ row, canEdit, onOpen }: { row: BoardRow; canEdit: boolean; onOpen: () => void }) {
  const linked = row.discordUsername || row.discordId;
  const body = linked ? (
    <>
      <div>{row.discordUsername ?? "—"}</div>
      <div className="text-xs text-muted">{row.discordId ?? "no ID"}</div>
    </>
  ) : (
    <span className={canEdit ? "chip bg-bad/15 text-bad" : "flag flag-mute"}>
      {canEdit ? "link…" : "not linked"}
    </span>
  );
  if (!canEdit) return <div>{body}</div>;
  return (
    <button className="text-left hover:text-accent" onClick={onOpen}>
      {body}
    </button>
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
        <input
          className="input w-52"
          value={discordId}
          onChange={(e) => setId(e.target.value.trim())}
          placeholder="437304427456495618"
        />
      </div>
      <div>
        <label className="label">Discord username</label>
        <input className="input w-44" value={username} onChange={(e) => setUser(e.target.value)} />
      </div>
      <button
        className="btn btn-primary"
        disabled={pending}
        onClick={() =>
          exec(
            () => savePlayer({ tag: row.tag, discordId, discordUsername: username }),
            (r) => r.ok && onClose(),
          )
        }
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
          <input
            className="input"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="#ABC123"
          />
        </div>
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button
          className="btn btn-primary"
          disabled={pending || !tag}
          onClick={() =>
            exec(
              () => addPlayerToBoard(seasonId, clanTag, tag, name),
              (r) => r.ok && (setTag(""), setName("")),
            )
          }
        >
          Add
        </button>
        <Result result={result} />
      </div>
    </details>
  );
}

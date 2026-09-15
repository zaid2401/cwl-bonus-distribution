"use client";

import { useState } from "react";
import { deletePlayer, savePlayer } from "@/lib/actions";
import { Result, useAction } from "./ActionButton";

type P = { tag: string; name: string; discordId: string | null; discordUsername: string | null; pn: number | null; isGuest: boolean; notes: string | null };

export function PlayersTable({ rows }: { rows: P[] }) {
  return (
    <div className="space-y-4">
      <NewPlayer />
      <div className="card overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="th">Name</th>
              <th className="th">Tag</th>
              <th className="th">Discord ID</th>
              <th className="th">Discord username</th>
              <th className="th">PN</th>
              <th className="th">Guest</th>
              <th className="th">Notes</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Row key={r.tag} p={r} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ p }: { p: P }) {
  const [v, setV] = useState({ discordId: p.discordId ?? "", discordUsername: p.discordUsername ?? "", pn: p.pn?.toString() ?? "", notes: p.notes ?? "" });
  const { pending, result, exec } = useAction();
  const dirty = v.discordId !== (p.discordId ?? "") || v.discordUsername !== (p.discordUsername ?? "") || v.pn !== (p.pn?.toString() ?? "") || v.notes !== (p.notes ?? "");
  const save = () =>
    exec(() => savePlayer({ tag: p.tag, discordId: v.discordId, discordUsername: v.discordUsername, pn: v.pn === "" ? null : Number(v.pn), notes: v.notes }));
  return (
    <tr className="hover:bg-panel2">
      <td className="td font-medium">{p.name || "—"}</td>
      <td className="td text-muted">{p.tag}</td>
      <td className="td">
        <input className={`input w-48 py-1 ${!v.discordId ? "border-bad/50" : ""}`} value={v.discordId} onChange={(e) => setV({ ...v, discordId: e.target.value.trim() })} />
      </td>
      <td className="td">
        <input className="input w-40 py-1" value={v.discordUsername} onChange={(e) => setV({ ...v, discordUsername: e.target.value })} />
      </td>
      <td className="td">
        <input className="input w-14 py-1 text-center" value={v.pn} onChange={(e) => setV({ ...v, pn: e.target.value.replace(/\D/g, "") })} />
      </td>
      <td className="td">
        <input type="checkbox" checked={p.isGuest} disabled={pending} onChange={(e) => exec(() => savePlayer({ tag: p.tag, isGuest: e.target.checked }))} />
      </td>
      <td className="td">
        <input className="input w-40 py-1" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
      </td>
      <td className="td whitespace-nowrap text-right">
        {dirty && (
          <button className="btn btn-primary btn-sm mr-1" disabled={pending} onClick={save}>
            Save
          </button>
        )}
        <button className="btn btn-danger btn-sm" disabled={pending} onClick={() => confirm(`Delete ${p.name || p.tag}?`) && exec(() => deletePlayer(p.tag))}>
          ✕
        </button>
        {result && !result.ok && <Result result={result} />}
      </td>
    </tr>
  );
}

function NewPlayer() {
  const [v, setV] = useState({ tag: "", name: "", discordId: "", discordUsername: "", pn: "" });
  const { pending, result, exec } = useAction();
  return (
    <details className="card p-3">
      <summary className="cursor-pointer text-sm font-semibold">Add player</summary>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        {(["tag", "name", "discordId", "discordUsername", "pn"] as const).map((k) => (
          <div key={k}>
            <label className="label">{{ tag: "Tag", name: "Name", discordId: "Discord ID", discordUsername: "Discord username", pn: "PN" }[k]}</label>
            <input className={`input ${k === "pn" ? "w-16" : ""}`} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
          </div>
        ))}
        <button
          className="btn btn-primary"
          disabled={pending || !v.tag}
          onClick={() =>
            exec(
              () => savePlayer({ tag: v.tag, name: v.name, discordId: v.discordId, discordUsername: v.discordUsername, pn: v.pn ? Number(v.pn) : null }),
              (r) => r.ok && setV({ tag: "", name: "", discordId: "", discordUsername: "", pn: "" }),
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

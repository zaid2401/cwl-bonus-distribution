"use client";

import { useState } from "react";
import { addClan, deleteClan, updateClan } from "@/lib/actions";
import { Result, useAction } from "./ActionButton";

type Clan = { tag: string; name: string; cwlType: string; isAlliance: boolean; sortOrder: number };

const TYPES = [
  { value: "cwl", label: "CWL clan" },
  { value: "none", label: "Not a CWL clan" },
];

export function ClansManager({ clans }: { clans: Clan[] }) {
  const [tags, setTags] = useState("");
  const [cwlType, setType] = useState("cwl");
  const [isAlliance, setAlliance] = useState(true);
  const { pending, result, exec } = useAction();

  const addAll = () =>
    exec(async () => {
      const list = tags.split(/[\s,;]+/).filter(Boolean);
      const msgs: string[] = [];
      let ok = true;
      for (const t of list) {
        const r = await addClan({ tag: t, cwlType, isAlliance });
        ok &&= r.ok;
        msgs.push(r.message);
      }
      if (ok) setTags("");
      return { ok, message: msgs.join(" ") };
    });

  return (
    <div className="space-y-4">
      <div className="card space-y-3 p-4">
        <div className="font-semibold">Add clans</div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-72 flex-1">
            <label className="label">Clan tag(s) — separate several with spaces or commas</label>
            <input
              className="input w-full"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="#2PP #ABC123"
            />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={cwlType} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" checked={isAlliance} onChange={(e) => setAlliance(e.target.checked)} />{" "}
            Alliance clan (track donations)
          </label>
          <button className="btn btn-primary" disabled={pending || !tags.trim()} onClick={addAll}>
            {pending ? "Adding…" : "Add"}
          </button>
        </div>
        <Result result={result} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="th w-20">Order</th>
              <th className="th">Name</th>
              <th className="th">Tag</th>
              <th className="th">CWL type</th>
              <th className="th">Alliance (donations)</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {clans.map((c) => (
              <ClanRow key={c.tag} clan={c} />
            ))}
            {clans.length === 0 && (
              <tr>
                <td className="td text-muted" colSpan={6}>
                  No clans yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClanRow({ clan }: { clan: Clan }) {
  const { pending, result, exec } = useAction();
  const [name, setName] = useState(clan.name);
  const [order, setOrder] = useState(String(clan.sortOrder));
  return (
    <tr className="hover:bg-panel2">
      <td className="td">
        <input
          className="input w-16 py-1"
          value={order}
          onChange={(e) => setOrder(e.target.value.replace(/\D/g, ""))}
          onBlur={() =>
            Number(order) !== clan.sortOrder && exec(() => updateClan(clan.tag, { sortOrder: Number(order) }))
          }
        />
      </td>
      <td className="td">
        <input
          className="input w-56 py-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== clan.name && exec(() => updateClan(clan.tag, { name }))}
        />
      </td>
      <td className="td text-muted">{clan.tag}</td>
      <td className="td">
        <select
          className="input py-1"
          value={clan.cwlType}
          disabled={pending}
          onChange={(e) => exec(() => updateClan(clan.tag, { cwlType: e.target.value }))}
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </td>
      <td className="td">
        <input
          type="checkbox"
          checked={clan.isAlliance}
          disabled={pending}
          onChange={(e) => exec(() => updateClan(clan.tag, { isAlliance: e.target.checked }))}
        />
      </td>
      <td className="td text-right">
        <button
          className="btn btn-danger btn-sm"
          disabled={pending}
          onClick={() => confirm(`Remove ${clan.name || clan.tag}?`) && exec(() => deleteClan(clan.tag))}
        >
          Remove
        </button>
        {result && !result.ok && <Result result={result} />}
      </td>
    </tr>
  );
}

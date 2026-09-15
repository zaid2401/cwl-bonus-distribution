"use client";

import { useState } from "react";
import { addClanToSeason, updateSeason } from "@/lib/actions";
import { Result, useAction } from "./ActionButton";

export function SeasonSettings({
  season,
  clans,
}: {
  season: { id: string; label: string; sortKey: string; donationSeason: string | null };
  clans: { tag: string; name: string }[];
}) {
  const [label, setLabel] = useState(season.label);
  const [sortKey, setSortKey] = useState(season.sortKey);
  const [donationSeason, setDonationSeason] = useState(season.donationSeason ?? "");
  const [clan, setClan] = useState("");
  const { pending, result, exec } = useAction();

  return (
    <details className="card p-4">
      <summary className="cursor-pointer font-semibold">Season settings</summary>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Label</label>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div>
          <label className="label">Order date (history order)</label>
          <input className="input" value={sortKey} onChange={(e) => setSortKey(e.target.value)} placeholder="2026-09-01" />
        </div>
        <div>
          <label className="label">Donation season</label>
          <input className="input" value={donationSeason} onChange={(e) => setDonationSeason(e.target.value)} placeholder="2026-08" />
        </div>
        <button
          className="btn btn-primary"
          disabled={pending}
          onClick={() => exec(() => updateSeason(season.id, { label, sortKey, donationSeason: donationSeason || null }))}
        >
          Save
        </button>
      </div>
      {clans.length > 0 && (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Add a clan to this season manually</label>
            <select className="input" value={clan} onChange={(e) => setClan(e.target.value)}>
              <option value="">Choose clan…</option>
              {clans.map((c) => (
                <option key={c.tag} value={c.tag}>
                  {c.name || c.tag} ({c.tag})
                </option>
              ))}
            </select>
          </div>
          <button className="btn" disabled={pending || !clan} onClick={() => exec(() => addClanToSeason(season.id, clan))}>
            Add clan
          </button>
        </div>
      )}
      <div className="mt-2">
        <Result result={result} />
      </div>
    </details>
  );
}

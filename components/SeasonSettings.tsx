"use client";

import { useState } from "react";
import { updateSeason } from "@/lib/actions";
import { Result, useAction } from "./ActionButton";

export function SeasonSettings({
  season,
}: {
  season: { id: string; label: string; sortKey: string; donationSeason: string | null };
}) {
  const [label, setLabel] = useState(season.label);
  const [sortKey, setSortKey] = useState(season.sortKey);
  const [donationSeason, setDonationSeason] = useState(season.donationSeason ?? "");
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
          <input
            className="input"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            placeholder="2026-09-01"
          />
        </div>
        <div>
          <label className="label">Donation season</label>
          <input
            className="input"
            value={donationSeason}
            onChange={(e) => setDonationSeason(e.target.value)}
            placeholder="2026-08"
          />
        </div>
        <button
          className="btn btn-primary"
          disabled={pending}
          onClick={() =>
            exec(() => updateSeason(season.id, { label, sortKey, donationSeason: donationSeason || null }))
          }
        >
          Save
        </button>
      </div>
      <div className="mt-2">
        <Result result={result} />
      </div>
    </details>
  );
}

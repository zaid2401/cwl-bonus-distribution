"use client";

import { useState } from "react";
import { createSeason } from "@/lib/actions";
import { Result, useAction } from "./ActionButton";

export function NewSeasonForm() {
  const [id, setId] = useState("");
  const [label, setLabel] = useState("");
  const { pending, result, exec } = useAction();
  return (
    <details className="card p-4">
      <summary className="cursor-pointer font-semibold">Create a season manually</summary>
      <p className="mt-2 text-muted">
        Normally seasons are created automatically when you sync CWL. Use this for special events (e.g.{" "}
        <code>2026-06-2</code>).
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <label className="label">Season id</label>
          <input className="input" placeholder="2026-09" value={id} onChange={(e) => setId(e.target.value)} />
        </div>
        <div>
          <label className="label">Label (optional)</label>
          <input
            className="input"
            placeholder="Sep 2026"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <button
          className="btn btn-primary"
          disabled={pending || !id}
          onClick={() => exec(() => createSeason({ id, label }))}
        >
          Create
        </button>
      </div>
      <div className="mt-2">
        <Result result={result} />
      </div>
    </details>
  );
}

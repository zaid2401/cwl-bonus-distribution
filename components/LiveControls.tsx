"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Result, useAction } from "./ActionButton";
import type { ActionResult } from "@/lib/actions";

/** Refresh button + optional auto-refresh, with a "last updated" note. */
export function LiveControls({
  action,
  label,
  pendingText,
  lastUpdated,
  intervalSeconds = 60,
}: {
  action: () => Promise<ActionResult>;
  label: string;
  pendingText: string;
  lastUpdated: string | null;
  intervalSeconds?: number;
}) {
  const [auto, setAuto] = useState(false);
  const [tick, setTick] = useState(0);
  const { pending, result, exec } = useAction();
  const router = useRouter();

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => {
      exec(action);
      setTick((t) => t + 1);
    }, intervalSeconds * 1000);
    return () => clearInterval(id);
  }, [auto, intervalSeconds, action, exec]);

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button className="btn btn-primary" disabled={pending} onClick={() => exec(action)}>
        {pending ? pendingText : label}
      </button>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
        Auto every {intervalSeconds}s
        {auto && <span className="chip bg-good/15 text-good">live{tick ? ` · ${tick}` : ""}</span>}
      </label>
      {lastUpdated && <span className="text-xs text-muted">Data from {lastUpdated}</span>}
      <Result result={result} />
    </div>
  );
}

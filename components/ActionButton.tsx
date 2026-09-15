"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/actions";

export function useAction() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const router = useRouter();
  const exec = (fn: () => Promise<ActionResult>, onDone?: (r: ActionResult) => void) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      router.refresh();
      onDone?.(r);
    });
  return { pending, result, setResult, exec };
}

export function Result({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p className={`text-sm ${result.ok ? "text-good" : "text-bad"}`}>
      {result.message}{" "}
      {result.url && (
        <a href={result.url} target="_blank" rel="noreferrer" className="underline">
          Open
        </a>
      )}
    </p>
  );
}

export function ActionButton({
  action,
  children,
  className = "btn",
  confirm,
  pendingText,
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  pendingText?: string;
}) {
  const { pending, result, exec } = useAction();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        className={className}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          exec(action);
        }}
      >
        {pending ? (pendingText ?? "Working…") : children}
      </button>
      <Result result={result} />
    </span>
  );
}

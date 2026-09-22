"use client";

import { setClanActive } from "@/lib/actions";
import { useAction } from "./ActionButton";

export function ClanSeasonToggle({
  seasonId,
  clanTag,
  active,
  disabled,
}: {
  seasonId: string;
  clanTag: string;
  active: boolean;
  disabled?: boolean;
}) {
  const { pending, result, exec } = useAction();
  return (
    <div className="flex items-center gap-1">
      <input
        type="checkbox"
        className="size-4 accent-[var(--color-accent)]"
        checked={active}
        disabled={disabled || pending}
        title={active ? "Using this clan this season" : "Not using this clan this season"}
        onChange={(e) => exec(() => setClanActive(seasonId, clanTag, e.target.checked))}
      />
      {result && !result.ok && (
        <span className="text-bad" title={result.message}>
          !
        </span>
      )}
    </div>
  );
}

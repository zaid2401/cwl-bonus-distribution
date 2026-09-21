"use client";

import { useState } from "react";
import { trackPlayer } from "@/lib/actions";
import { Result, useAction } from "./ActionButton";

export function TrackPlayer() {
  const [tag, setTag] = useState("");
  const { pending, result, exec } = useAction();
  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
      <div>
        <label className="label">Track a player who is not in a family clan</label>
        <input
          className="input w-48"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="#ABC123"
        />
      </div>
      <button
        className="btn"
        disabled={pending || !tag.trim()}
        onClick={() =>
          exec(
            () => trackPlayer(tag),
            (r) => r.ok && setTag(""),
          )
        }
      >
        {pending ? "Checking…" : "Track player"}
      </button>
      <Result result={result} />
    </div>
  );
}

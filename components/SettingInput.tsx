"use client";

import { useState } from "react";
import { saveSetting } from "@/lib/actions";
import { Result, useAction } from "./ActionButton";

export function SettingInput({ settingKey, initial, placeholder }: { settingKey: string; initial: string; placeholder?: string }) {
  const [val, setVal] = useState(initial);
  const { pending, result, exec } = useAction();
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input className="input flex-1" value={val} onChange={(e) => setVal(e.target.value)} placeholder={placeholder} />
        <button className="btn btn-primary" disabled={pending || val === initial} onClick={() => exec(() => saveSetting(settingKey, val.trim()))}>
          Save
        </button>
      </div>
      <Result result={result} />
    </div>
  );
}

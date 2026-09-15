"use client";

import { useActionState } from "react";
import { login } from "@/lib/actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <div className="mx-auto mt-24 max-w-sm">
      <form action={action} className="card space-y-4 p-6">
        <h1 className="text-lg font-bold">
          <span className="text-accent">JPA</span> CWL Bonus
        </h1>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input id="password" name="password" type="password" className="input w-full" autoFocus required />
        </div>
        {state && !state.ok && <p className="text-sm text-bad">{state.message}</p>}
        <button className="btn btn-primary w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

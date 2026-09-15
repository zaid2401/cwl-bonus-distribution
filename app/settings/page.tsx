import { eq } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import { ActionButton } from "@/components/ActionButton";
import { SettingInput } from "@/components/SettingInput";
import { testApi } from "@/lib/actions";

export const dynamic = "force-dynamic";

function Status({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <li className="flex items-start gap-2">
      <span className={ok ? "text-good" : "text-bad"}>{ok ? "✔" : "✖"}</span>
      <div>
        <div className="font-medium">{label}</div>
        {!ok && <div className="text-xs text-muted">{hint}</div>}
      </div>
    </li>
  );
}

export default async function SettingsPage() {
  const db = await getDb();
  const [row] = await db.select().from(s.settings).where(eq(s.settings.key, "exportSheetUrl"));
  const env = process.env;
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Configuration status</h2>
        <ul className="space-y-2 text-sm">
          <Status ok={Boolean(env.COC_API_TOKEN)} label="Clash of Clans API token" hint="Set COC_API_TOKEN. Whitelist IP 45.79.218.79 when creating the key." />
          <Status ok={Boolean(env.DATABASE_URL)} label="Hosted database (Supabase)" hint="Not set — using the local embedded database in ./.data (fine for local use)." />
          <Status ok={Boolean(env.ADMIN_PASSWORD)} label="Admin password" hint="Set ADMIN_PASSWORD. Required when hosted." />
          <Status ok={Boolean(env.CRON_SECRET)} label="Daily auto-sync secret" hint="Set CRON_SECRET so the daily Vercel job can run." />
          <Status
            ok={Boolean(env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_PRIVATE_KEY)}
            label="Google service account (export)"
            hint="Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY."
          />
        </ul>
        <div className="text-xs text-muted">API base: {env.COC_API_BASE || "https://cocproxy.royaleapi.dev/v1"}</div>
        <ActionButton action={testApi} pendingText="Testing…">
          Test Clash of Clans API
        </ActionButton>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Export Google Sheet</h2>
        <p className="text-sm text-muted">
          Create an empty Google Sheet, share it as <b>Editor</b> with{" "}
          <code className="text-text">{env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "your service account email"}</code>, and paste its link here. Each export
          writes a tab named “CWL &lt;season&gt;”.
        </p>
        <SettingInput settingKey="exportSheetUrl" initial={row?.value ?? ""} placeholder="https://docs.google.com/spreadsheets/d/…/edit" />
      </section>
    </div>
  );
}

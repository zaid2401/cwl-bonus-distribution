import { buildSeasonExport } from "@/lib/export";
import { currentRole } from "@/lib/session";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/export/[season]">) {
  // The proxy already turns everyone but Zaid away. Belt and braces: this route hands out
  // the whole season in one file, so it asks for itself too.
  if ((await currentRole()) !== "admin") return new Response("Forbidden", { status: 403 });
  const { season } = await ctx.params;
  const data = await buildSeasonExport(decodeURIComponent(season));
  const rows = data.rows.map((r) => r.map((v) => (typeof v === "string" ? v.replace(/^'(\d+)$/, "$1") : v)));
  return new Response("﻿" + toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${data.title.replace(/[^\w -]/g, "")}.csv"`,
    },
  });
}

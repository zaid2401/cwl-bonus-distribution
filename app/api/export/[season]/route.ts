import { buildSeasonExport } from "@/lib/export";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/export/[season]">) {
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

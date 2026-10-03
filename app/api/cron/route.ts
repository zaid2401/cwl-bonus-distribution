import { NextResponse, type NextRequest } from "next/server";
import { syncAllCwl } from "@/lib/sync";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Daily job (Vercel Cron): sync CWL wars.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cwl = await syncAllCwl();
  return NextResponse.json({ cwl });
}

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSession } from "./lib/auth";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/login" || pathname.startsWith("/api/cron")) return NextResponse.next();
  if (await isValidSession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

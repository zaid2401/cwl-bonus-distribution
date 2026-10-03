import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionRole } from "./lib/auth";

// The bonus leader only needs the season pages. Everything else — clans, players, imports,
// settings, the export routes — is Zaid's, and a wrong turn lands back on the board.
const bonusCanSee = (path: string) =>
  path === "/" || path.startsWith("/seasons/") || path.startsWith("/_next/");

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/login" || pathname.startsWith("/api/cron")) return NextResponse.next();
  const role = await sessionRole(req.cookies.get(SESSION_COOKIE)?.value);
  if (!role) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (role === "bonus" && !bonusCanSee(pathname)) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

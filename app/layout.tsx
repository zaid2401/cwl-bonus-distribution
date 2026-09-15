import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import "./globals.css";
import { SESSION_COOKIE, isValidSession, authDisabled } from "@/lib/auth";
import { logout } from "@/lib/actions";

export const metadata: Metadata = { title: "JPA CWL Bonus", robots: { index: false } };

const nav = [
  { href: "/", label: "Seasons" },
  { href: "/clans", label: "Clans" },
  { href: "/players", label: "Players" },
  { href: "/import", label: "Import" },
  { href: "/settings", label: "Settings" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const loggedIn = await isValidSession((await cookies()).get(SESSION_COOKIE)?.value);
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {loggedIn && (
          <header className="border-b border-line bg-panel">
            <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
              <Link href="/" className="font-bold tracking-tight">
                <span className="text-accent">JPA</span> CWL Bonus
              </Link>
              <nav className="flex flex-wrap gap-1">
                {nav.map((n) => (
                  <Link key={n.href} href={n.href} className="rounded px-2.5 py-1 text-muted hover:bg-panel2 hover:text-text">
                    {n.label}
                  </Link>
                ))}
              </nav>
              <div className="ml-auto">
                {!authDisabled() && (
                  <form action={logout}>
                    <button className="btn btn-sm">Log out</button>
                  </form>
                )}
              </div>
            </div>
          </header>
        )}
        <main className="mx-auto max-w-[1500px] px-4 py-6">{children}</main>
      </body>
    </html>
  );
}

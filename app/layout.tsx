import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { authDisabled } from "@/lib/auth";
import { currentRole } from "@/lib/session";
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
  const role = await currentRole();
  const loggedIn = role !== null;
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
                {role === "bonus" && (
                  <span className="chip bg-accent/15 text-accent" title="You can tick bonuses, nothing else">
                    bonus picks only
                  </span>
                )}
                {(role === "admin" ? nav : []).map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="rounded px-2.5 py-1 text-muted hover:bg-panel2 hover:text-text"
                  >
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

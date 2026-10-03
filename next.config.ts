import type { NextConfig } from "next";

// Everything this app loads, it serves itself: no CDN, no fonts, no analytics, no embeds.
// So the policy is "self and nothing else", which is what stops a stray script from
// shipping the board — or the session cookie — somewhere else.
//
// `unsafe-inline` on scripts is Next's own bootstrap and streamed data, which carry no
// nonce in a static header. Worth having anyway: it is the external origins and the
// `connect-src` that an attacker needs, and those are shut.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  // Migrations are read from disk at runtime, so ship them with every function.
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
  // Nothing here is public, so nothing here should be framed, sniffed, indexed, or leak a
  // referrer to the next site along.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  // Migrations are read from disk at runtime, so ship them with every function.
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
};

export default nextConfig;

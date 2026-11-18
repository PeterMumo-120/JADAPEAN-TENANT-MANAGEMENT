import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // Dev-only SQLite driver (native addon). Keep it out of the bundle, load it with plain require().
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (pdfjs-dist) dynamically resolves a worker script at runtime;
  // letting Turbopack/webpack bundle it breaks that path resolution, so it
  // must run as a plain Node require instead.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;

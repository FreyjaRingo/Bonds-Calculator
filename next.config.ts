import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (pdfjs-dist) dynamically resolves a worker script at runtime;
  // letting Turbopack/webpack bundle it breaks that path resolution, so it
  // must run as a plain Node require instead.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  // pdfjs-dist optionally requires @napi-rs/canvas (for DOMMatrix/ImageData/Path2D
  // polyfills) inside a try/catch, which Next.js's output file tracing can't see
  // statically — without this, the package (and its platform-specific native
  // binary) gets pruned from the deployed serverless function and PDF parsing
  // crashes in production with "DOMMatrix is not defined".
  outputFileTracingIncludes: {
    "/api/price-quotes/parse": [
      "node_modules/@napi-rs/**/*",
      "node_modules/pdf-parse/node_modules/@napi-rs/**/*",
      "node_modules/pdfjs-dist/**/*",
    ],
  },
};

export default nextConfig;

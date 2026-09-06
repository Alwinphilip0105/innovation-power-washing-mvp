import type { NextConfig } from "next";

/**
 * One app, two builds.
 *
 * The default build is the whole product — API routes, sign-in and the owner
 * dashboard — and needs a Node/serverless host.
 *
 * `STATIC_EXPORT=1` produces the GitHub Pages build: plain files with no server
 * behind them. Pages cannot run a route handler or read a session cookie, so
 * that build carries only the public site and the demos, and its browser code
 * calls the full deployment over `NEXT_PUBLIC_API_BASE_URL`
 * (see `lib/api/client.ts`).
 *
 * The server-only routes are removed from a scratch copy of the tree before
 * this build runs — see `scripts/build-static.mjs`, which is the only supported
 * way to produce the export. Running `STATIC_EXPORT=1 next build` against the
 * real tree fails, because `output: "export"` cannot compile a route handler.
 */
const staticExport = process.env.STATIC_EXPORT === "1";

// A project Pages site is served from /<repo>/, not from the domain root.
const basePath = process.env.PAGES_BASE_PATH?.replace(/\/+$/, "") || undefined;

const nextConfig: NextConfig = staticExport
  ? {
      output: "export",
      // Pages serves /about/ as /about/index.html; without this every link
      // except the home page 404s.
      trailingSlash: true,
      // There is no image optimiser on a static host.
      images: { unoptimized: true },
      basePath,
      assetPrefix: basePath,
    }
  : {};

export default nextConfig;

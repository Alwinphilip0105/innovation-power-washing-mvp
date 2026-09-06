// @ts-check
/**
 * Builds the static GitHub Pages export.
 *
 * A static export cannot contain route handlers or pages that read a session
 * cookie, so the API, sign-in and dashboard have to be absent from the tree
 * Next compiles. Rather than delete them from the working tree — which would
 * destroy source if the build were interrupted — this copies the source into a
 * scratch directory, removes them there, and builds that.
 *
 * Building a real copy (instead of, say, filtering routes through config) means
 * Next sees a genuinely smaller app: its generated route types match what is
 * being built, and `next build` behaves exactly as it does normally.
 *
 * `.env.local` is deliberately not copied. The export ships to a public host,
 * so its configuration must be explicit and secret-free.
 *
 * Output lands in ./out.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = path.join(root, ".static-build");
const outDir = path.join(root, "out");

/** Copied into the scratch tree. Anything not listed simply is not needed. */
const SOURCES = [
  "app",
  "components",
  "lib",
  "services",
  "public",
  "next.config.ts",
  "tsconfig.json",
  "next-env.d.ts",
  "postcss.config.mjs",
  "eslint.config.mjs",
  "package.json",
];

/**
 * Cannot exist in a static export: no server to run them. `components/dashboard`
 * goes too — it is imported only by the dashboard pages, and its server actions
 * live in `app/dashboard/actions.ts`, which has just been removed.
 */
const SERVER_ONLY = [
  path.join("app", "api"),
  path.join("app", "dashboard"),
  path.join("app", "login"),
  path.join("components", "dashboard"),
];

function log(message) {
  console.log(`[build-static] ${message}`);
}

function requireEnv(name, hint) {
  const value = process.env[name];
  if (!value) {
    console.error(
      `[build-static] ${name} is not set.\n` +
        `  ${hint}\n` +
        `  Without it the exported site would ship with a dead chat, booking form and voice demo.`,
    );
    process.exit(1);
  }
  return value;
}

const apiBaseUrl = requireEnv(
  "NEXT_PUBLIC_API_BASE_URL",
  "Set it to the origin of the full deployment that answers this site's API calls, e.g. https://your-app.vercel.app",
);
const appUrl = requireEnv(
  "NEXT_PUBLIC_APP_URL",
  "Set it to the public URL of the Pages site itself, e.g. https://you.github.io/repo — it is used for canonical URLs, the sitemap and robots.txt.",
);

log(`API calls will go to ${apiBaseUrl}`);
log(`site will describe itself as ${appUrl}`);

fs.rmSync(buildDir, { recursive: true, force: true });
fs.mkdirSync(buildDir, { recursive: true });

for (const entry of SOURCES) {
  const from = path.join(root, entry);
  if (!fs.existsSync(from)) continue;
  fs.cpSync(from, path.join(buildDir, entry), { recursive: true });
}

for (const entry of SERVER_ONLY) {
  fs.rmSync(path.join(buildDir, entry), { recursive: true, force: true });
  log(`excluded ${entry}`);
}

// Reuse the installed dependencies instead of a second install. A junction is
// used because it is the one link type Windows grants without elevation, and
// on POSIX Node treats the request as an ordinary directory symlink.
fs.symlinkSync(path.join(root, "node_modules"), path.join(buildDir, "node_modules"), "junction");

log("building...");
execFileSync(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), "build"], {
  cwd: buildDir,
  stdio: "inherit",
  env: {
    ...process.env,
    STATIC_EXPORT: "1",
    // The export is generated from the seeded demo dataset, so the build needs
    // no database and no credentials. The live data a visitor actually sees
    // comes from the API deployment at request time.
    DATA_STORE: "memory",
    NODE_ENV: "production",
  },
});

fs.rmSync(outDir, { recursive: true, force: true });
fs.cpSync(path.join(buildDir, "out"), outDir, { recursive: true });

// Pages runs the upload through Jekyll otherwise, which drops every directory
// whose name begins with an underscore — including Next's _next asset folder.
fs.writeFileSync(path.join(outDir, ".nojekyll"), "");

fs.rmSync(buildDir, { recursive: true, force: true });

const pages = fs
  .readdirSync(outDir, { recursive: true })
  .filter((entry) => String(entry).endsWith(".html")).length;

log(`done — ${pages} pages in ./out`);

// @ts-check
/**
 * Builds the static GitHub Pages export: a self-contained demo.
 *
 * A static export cannot contain route handlers or pages that read a session
 * cookie, so the API, sign-in and dashboard have to be absent from the tree
 * Next compiles. Rather than delete them from the working tree — which would
 * destroy source if the build were interrupted — this copies the source into a
 * scratch directory, removes them there, and builds that.
 *
 * The demo still works, because the browser runs the API handlers itself
 * against the seeded in-memory dataset. Chat, booking and the voice demo need
 * no backend, no keys and no configuration — this export depends on nothing at
 * runtime. Only sign-in and the owner dashboard link out to a real deployment.
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
        `  Without it the exported site would ship with dead sign-in and dashboard links.`,
    );
    process.exit(1);
  }
  return value;
}

const apiBaseUrl = requireEnv(
  "NEXT_PUBLIC_API_BASE_URL",
  "Set it to the origin of the full deployment. The demo itself does not call it - this is only where the 'Staff Login' and 'open it in the dashboard' links point, since neither exists in a static export.",
);
const appUrl = requireEnv(
  "NEXT_PUBLIC_APP_URL",
  "Set it to the public URL of the Pages site itself, e.g. https://you.github.io/repo — it is used for canonical URLs, the sitemap and robots.txt.",
);

log(`sign-in and dashboard links will point at ${apiBaseUrl}`);
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

/**
 * The static build runs the service layer in the browser, so the modules it
 * reaches cannot be marked `server-only`.
 *
 * That marker is load-bearing in the real build - it is what stops the
 * Supabase store, and the service-role key it holds, being pulled into a
 * client bundle - so it is stripped here rather than deleted from the source.
 * It is safe to strip in this tree specifically: `.env.local` is not copied,
 * no Supabase credentials exist, and the Supabase store is replaced below with
 * a stub that cannot construct.
 */
function unmarkServerOnly(relativePath) {
  const file = path.join(buildDir, relativePath);
  const before = fs.readFileSync(file, "utf8");
  const after = before.replace(/^import "server-only";\n\n?/m, "");
  if (after === before) {
    throw new Error(
      `${relativePath} no longer starts with an \`import "server-only"\`. ` +
        `The static build strips that marker deliberately - check what changed before removing this.`,
    );
  }
  fs.writeFileSync(file, after);
  log(`unmarked server-only: ${relativePath}`);
}

unmarkServerOnly(path.join("lib", "db", "index.ts"));
unmarkServerOnly(path.join("lib", "bootstrap.ts"));

// Nothing can reach Supabase from a static host, and bundling its SDK into the
// browser would cost ~100KB to sit unused. The store is selected by env, and
// no credentials exist here, so this is never constructed.
fs.writeFileSync(
  path.join(buildDir, "lib", "db", "supabase-store.ts"),
  `import type { DataStore } from "@/lib/db/store";

/** Stub swapped in by scripts/build-static.mjs - see the note there. */
class SupabaseStoreStub {
  constructor() {
    throw new Error("The static build has no Supabase store; it runs on the seeded in-memory dataset.");
  }
}

// The real class implements DataStore. This one exists only to be unreachable,
// so the shape is asserted rather than implemented.
export const SupabaseStore = SupabaseStoreStub as unknown as new () => DataStore;
`,
);
log("stubbed lib/db/supabase-store.ts");

// There is no server to call, so the browser runs the API handlers itself.
// Swapping the whole transport file (rather than branching at runtime) is what
// keeps the real build's client bundle from ever referencing them.
fs.renameSync(
  path.join(buildDir, "lib", "api", "transport-browser.ts"),
  path.join(buildDir, "lib", "api", "transport.ts"),
);
log("swapped in the in-browser API transport");

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
    // Seeded in-memory dataset, at build time and again in each visitor's
    // browser at runtime. No database, no credentials, nothing shared.
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

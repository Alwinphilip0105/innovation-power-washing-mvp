// @ts-check
/**
 * Builds the static export and tests it as a static host would serve it.
 *
 * The env the build requires is supplied here with local placeholders, so the
 * check runs anywhere without configuration. Only the sign-in and dashboard
 * links use those values; the demo itself calls nothing.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const env = {
  ...process.env,
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://app.example.com",
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:4321",
  // Served from the root here, so no base path.
  PAGES_BASE_PATH: "",
};

const run = (/** @type {string[]} */ args) =>
  execFileSync(process.execPath, args, { cwd: root, stdio: "inherit", env });

run([path.join(root, "scripts", "build-static.mjs")]);
run([
  path.join(root, "node_modules", "@playwright", "test", "cli.js"),
  "test",
  "-c",
  "playwright.static.config.ts",
]);

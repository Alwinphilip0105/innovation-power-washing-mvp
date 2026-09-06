// @ts-check
/**
 * Serves ./out the way a static host does, for the self-contained export tests.
 *
 * Deliberately dumb: no rewrites, no fallbacks beyond the directory-index and
 * 404 rules GitHub Pages itself applies. A test that passes here should pass
 * there, and a route that only works because a dev server was clever should
 * fail here.
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "out");
const port = Number(process.env.PORT ?? 4321);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

http
  .createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://localhost:${port}`);
    let filePath = path.join(root, decodeURIComponent(url.pathname));

    // Refuse to serve anything outside ./out, whatever the path claims.
    if (!filePath.startsWith(root)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
    if (!fs.existsSync(filePath) && fs.existsSync(`${filePath}.html`)) {
      filePath = `${filePath}.html`;
    }

    if (!fs.existsSync(filePath)) {
      const notFound = path.join(root, "404.html");
      response.writeHead(404, { "Content-Type": TYPES[".html"] });
      response.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : "Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": TYPES[path.extname(filePath)] ?? "application/octet-stream",
    });
    response.end(fs.readFileSync(filePath));
  })
  .listen(port, () => console.log(`[serve-static] ./out on http://localhost:${port}`));

# Hosting the demo on GitHub Pages

The public site — the marketing pages, the chat widget, the booking form and
the voice demo — ships to GitHub Pages as a **self-contained** static export.
It depends on nothing at runtime: no server, no database, no API keys, no
configuration. Open the page and the product works.

## How that is possible

GitHub Pages serves files and runs no code. The trick is that almost none of
this product actually needs a server — it needs *code to run somewhere*, and a
browser is somewhere.

The public API is written as transport-agnostic handlers in
[`lib/api/handlers.ts`](../lib/api/handlers.ts). Two things call them:

- **On a real deployment**, the route handlers in `app/api/*`. They add the
  parts only a server can do — rate limiting by client address — and put the
  result on the wire.
- **In the static export**, the browser itself, via
  [`lib/api/transport-browser.ts`](../lib/api/transport-browser.ts), which
  returns a real `Response` so no caller can tell the difference.

Same handlers, same Zod validation, same booking rules, same assistant, same
JSON. A fix to either lands on both.

| Part | On Pages | How |
| --- | --- | --- |
| Marketing pages | ✅ | Prerendered at build time |
| Chat widget | ✅ | Assistant + tool loop run in the page |
| Booking form | ✅ | Real availability from the booking rules; books a real appointment |
| Voice demo and the Call buttons | ✅ | Speech in the browser, assistant in the browser |
| Owner dashboard, sign-in | ❌ | Server-rendered behind a session cookie — these link out |

### What you give up

The dataset is the seeded one, held **per visitor, in that tab**:

- A lead someone submits is visible only to them. Nothing is shared, and
  nothing reaches a real database.
- A reload starts the demo over.
- The assistant is the deterministic mock. The Anthropic provider needs an API
  key, which cannot ship to a browser.
- "Staff Login" and "open it in the dashboard" leave the site for the real
  deployment, because neither can exist here.

For a demo that is mostly upside: every visitor gets a clean, working product
with no shared state to corrupt and nothing to configure.

## Setup

### 1. Turn Pages on

**Settings → Pages → Build and deployment → Source: GitHub Actions.**

This must be *GitHub Actions*, not "Deploy from a branch". A branch source
serves the repository root, which renders `README.md` through Jekyll instead of
publishing the export.

On the Free plan Pages requires a public repository.

### 2. Push to `main`

[`.github/workflows/pages.yml`](../.github/workflows/pages.yml) builds and
publishes, and can also be run from the Actions tab.

That is the whole setup. There is no CORS to configure and no environment to
set, because the published site calls nothing.

### Optional repository variables

**Settings → Secrets and variables → Actions → Variables**

| Variable | Default | What it does |
| --- | --- | --- |
| `API_BASE_URL` | the current Vercel deployment | Where "Staff Login" and the dashboard links point. Not used by the demo itself. |
| `PAGES_URL` | `https://alwinphilip.online/<repo>` | The site's own public URL, for canonical tags, the sitemap and `robots.txt`. |

> **Custom domains:** this account's Pages site redirects `github.io` to
> `alwinphilip.online`, so that is the real origin. A custom domain does **not**
> move a project site to the root — it still serves from `/<repo>`, and the base
> path is computed accordingly.

## Building and testing it locally

```bash
npm run test:static
```

That builds the export and runs [`tests/static`](../tests/static) against it on
a deliberately dumb file server — no dev server, no rewrites — so anything that
would secretly need one fails there rather than in production. The load-bearing
assertion is the negative one: **no request may leave the origin.** If the
in-browser transport were ever swapped back for `fetch`, the demo would still
pass locally against a dev server and break the moment it was published; that
test is what catches it.

To build without testing:

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-app.vercel.app \
NEXT_PUBLIC_APP_URL=https://you.github.io/innovation-power-washing-mvp \
PAGES_BASE_PATH=/innovation-power-washing-mvp \
npm run build:static
```

Output lands in `out/`.

## How the static build is produced

`scripts/build-static.mjs` copies the source into a scratch directory and
changes it there — never the working tree, so an interrupted build cannot
destroy source. `.env.local` is deliberately not copied: the export ships to a
public host, so its configuration must be explicit and secret-free.

In that scratch copy it:

1. **Removes** `app/api`, `app/dashboard`, `app/login` and
   `components/dashboard` — nothing that needs a server survives.
2. **Strips `import "server-only"`** from `lib/db/index.ts` and
   `lib/bootstrap.ts`. That marker is load-bearing in the real build — it is
   what stops the Supabase store and its service-role key reaching a client
   bundle — so it is relaxed only here, where no credentials exist.
3. **Stubs `lib/db/supabase-store.ts`**, so the Supabase SDK is not bundled into
   the browser to sit unused.
4. **Swaps `transport-browser.ts` over `transport.ts`.** Replacing the file
   rather than branching at runtime is what keeps the real build's client bundle
   from ever referencing the handlers.

Then it builds that tree with `output: "export"`.

### Supporting changes in the shared code

- `lib/utils/id.ts` and `lib/sms/providers.ts` no longer use `node:crypto`;
  they use `lib/utils/sha256.ts`, a plain-TypeScript SHA-256 and HMAC pinned
  against Node's own implementation in `tests/unit/sha256.test.ts`. A single
  `node:crypto` import anywhere in that module graph would break the browser
  bundle. `lib/auth` still uses it, and is never reached from the browser.
- `/book?service=…` is read from the URL in the browser rather than from
  `searchParams` on the server, because a prerendered page has no request to
  read — see `lib/hooks/use-requested-service.ts`.

## About the CORS middleware

`middleware.ts` allows the origins in `CORS_ALLOWED_ORIGINS` to call the public
API cross-origin. **The Pages demo does not need it** — it calls nothing. It
stays for the case of pointing some other front end at a real deployment, and
is inert when the variable is unset.

# Hosting the demo on GitHub Pages

The public site — the marketing pages, the chat widget and the browser voice
demo — can be served from GitHub Pages. The rest of the product cannot, and this
document is mostly about that line.

## What Pages can and cannot serve

GitHub Pages serves files. It runs no code. So the export contains:

| Part | On Pages | Why |
| --- | --- | --- |
| Marketing pages (`/`, `/services`, `/book`, …) | ✅ served | Prerendered at build time |
| `/demo/voice` | ✅ served | Speech runs in the browser; the assistant is called over HTTP |
| Chat widget, booking form, lead form | ✅ shown, ⚠️ calls out | The forms are static; their `POST`s go to the API deployment |
| `POST /api/*` | ❌ absent | Route handlers need a server |
| `/login`, `/dashboard/*` | ❌ absent | Server-rendered behind a session cookie |

So Pages is the **front half** of a two-origin setup. The other half is a normal
deployment of this same repo (Vercel, or anything that runs Next) which keeps
the API, sign-in and the dashboard. Pages links out to it for those.

That means **the demo only works end to end once both halves are up**. A Pages
site pointed at nothing looks perfect and fails the moment anyone types into the
chat box.

## One-time setup

### 1. Deploy the full app somewhere with a server

Follow `docs/DEPLOYMENT.md`. Confirm it works before wiring Pages to it:

```bash
curl https://innovation-power-washing-mvp.vercel.app/api/health
```

Expect `"status": "ok"`. If it says `degraded`, fix that first — the `warnings`
array names what is unset. A deployment with no `AUTH_SECRET` or with
`dataStore.kind: "memory"` will produce a demo that loses data and signs people
out at random.

### 2. Let it accept calls from the Pages origin

On the deployment, set:

```
CORS_ALLOWED_ORIGINS=https://<owner>.github.io
```

Then **redeploy**. This value is read at build time on an edge runtime, so
editing it in a dashboard does nothing to the deployment already running.

Only the public browser endpoints are exposed this way (`/api/chat`,
`/api/leads`, `/api/availability`, `/api/appointments`, `/api/demo/*`,
`/api/health`). The webhook routes are not, and nothing behind sign-in is:
these endpoints carry no cookies, so no `Access-Control-Allow-Credentials` is
ever issued and a spoofed origin gains no session.

### 3. Point the repository at that deployment

The workflow already defaults to
`https://innovation-power-washing-mvp.vercel.app`, so nothing is needed here
unless that changes. To override, set repository variables under
**Settings → Secrets and variables → Actions → Variables**:

| Variable | Value |
| --- | --- |
| `API_BASE_URL` | `https://<your-deployment>` — origin only, no trailing path |
| `PAGES_URL` | only if serving from a custom domain |

### 4. Turn Pages on

**Settings → Pages → Source: GitHub Actions.**

Note: on a Free plan, Pages requires a **public** repository. This repo is
private, so this either needs the repo made public or a plan that includes Pages
from private repositories.

### 5. Push to `main`

`.github/workflows/pages.yml` builds and publishes. It also runs on demand from
the Actions tab.

## Building it locally

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-app.vercel.app \
NEXT_PUBLIC_APP_URL=https://you.github.io/innovation-power-washing-mvp \
PAGES_BASE_PATH=/innovation-power-washing-mvp \
npm run build:static
```

Output lands in `out/`. Serve it with any static server to check it, remembering
that the base path has to be part of the URL.

## How the two builds differ

`npm run build` produces the whole product. `npm run build:static` runs
`scripts/build-static.mjs`, which copies the source to a scratch directory,
deletes `app/api`, `app/dashboard`, `app/login` and `components/dashboard`, and
builds *that* with `output: "export"`.

It builds a copy rather than the working tree so an interrupted build cannot
destroy source, and `.env.local` is deliberately not copied — the export ships
to a public host, so its configuration is explicit and secret-free. The export
is generated from the seeded in-memory dataset (`DATA_STORE=memory`), so no
database credentials are needed to build it; the live data a visitor sees comes
from the API deployment at request time.

Two seams make the same components work in both builds:

- **`lib/api/client.ts`** — `apiUrl()` and `serverHref()` prefix
  `NEXT_PUBLIC_API_BASE_URL` when it is set and return a plain relative path
  when it is not. A single deployment is therefore unaffected: every call stays
  same-origin.
- **`lib/hooks/use-requested-service.ts`** — `/book?service=…` is read from the
  URL in the browser rather than from `searchParams` on the server, because a
  prerendered page has no request to read. It uses `useSyncExternalStore`, so
  the value is present on the render that hydrates and no form ever acts on the
  wrong service first.

## Checking a live deploy

1. Open the Pages URL. The pages should render fully — they are prerendered, so
   they look right even when the API is unreachable. **This proves nothing yet.**
2. Open the chat widget and send a message. A reply means the whole path works.
3. If it fails, open the browser console. A CORS error means step 2 of the setup
   was missed or not redeployed. A 404 means `API_BASE_URL` is wrong.
4. `curl https://<your-deployment>/api/health` lists `corsAllowedOrigins`;
   confirm the Pages origin is in it, spelled exactly, with no trailing slash.

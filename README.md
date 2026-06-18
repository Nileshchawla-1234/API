# Med-Spa Growth Scanner — The Compounding Method

Give a med-spa website URL, crawl it, score **5 growth pillars + a Compliance Surface**,
and an AI writes a short report shown on a sparse page whose only button books a call.

## Stack
- **Next.js (Vercel)** — landing, `/r/[slug]` report page, thin API routes, `/admin`
- **Node/TS worker (Railway)** — runs the scan pipeline (heavy crawling lives here)
- **Supabase** — Postgres + RLS, namespaced `scanner` schema
- **Browserless** — headless Chromium crawler (Playwright)
- **Google** — Places (discovery) + PageSpeed Insights + CrUX
- **Anthropic `claude-haiku-4-5`** — report copy from verified findings only (optional)
- **SpyFu** — paid/organic/competitor enrichment, graceful fallback (optional)
- **Cal.com** — booking webhook → leads

## Repo layout
```
/app                 Next.js (Vercel)
/worker              Node/TS (Railway): pgmq consumer running scan()
/packages/core       the scan engine: crawl, detect, compliance, score, composeReport
/supabase/migrations the `scanner` schema (run these at integration)
```

## Quick start (local, credential-free)
```bash
npm install
npm test                              # engine unit tests
npm run dev                           # app at http://localhost:3000
npm run scan -- --domain=example.com  # run a full scan from the CLI
```
Everything runs without credentials via dev stand-ins. To go live, copy
`.env.example` to `.env`, fill keys, run the SQL in `supabase/migrations`, and set
`BACKEND=supabase`. Full deploy steps in [`DEPLOY.md`](./DEPLOY.md).

## Branch map
| Branch | What it is |
|---|---|
| `main` | **Production** — the chosen frontend (**V1 "Console"**) + the full engine. Deploy this. |
| `concept/command-center` | Design concept **V2** — cinematic sci-fi command center (grid horizon, reactor core). |
| `concept/signal` | Design concept **V3** — kinetic, full-screen scan takeover, scroll-hijacked pillars. |
| `concept/nexus` | Design concept **V4** — interactive 3D wireframe core (WebGL/three.js). |
| `baseline/pre-frontend` | Reference snapshot of the engine + plain app, **before** the frontend redesign. |

The concept branches are design alternates kept for reference; `main` is the one that ships.
Each branch gets its own Vercel preview URL on push.

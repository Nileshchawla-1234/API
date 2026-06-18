# Deploy & Integration Guide

Two deploy targets + the client's Supabase. The code does **not** change at
integration — only env vars + one SQL migration.

## Targets
| Part | Host | Build | Start |
|---|---|---|---|
| `/app` | **Vercel** | `npm run build` (root) | Next.js (auto) |
| `/worker` | **Railway** | `npm install` | `npm run start -w @scanner/worker` |
| DB + queue | **Supabase** | run `supabase/migrations/0001_init.sql` | — |

## Step-by-step (integration)
1. **Supabase**
   - Run `supabase/migrations/0001_init.sql` in the SQL editor (creates the
     isolated `scanner` schema + `get_report` RPC — safe alongside the existing site).
   - Enable extensions (admin): `create extension if not exists pgmq;`
     `create extension if not exists pg_cron;` then `select pgmq.create('scans');`
2. **Env vars** (set in BOTH Vercel and Railway):
   ```
   BACKEND=supabase
   SUPABASE_URL=...            SUPABASE_SERVICE_KEY=...   (service key: worker/server only)
   BROWSERLESS_TOKEN=...
   GOOGLE_API_KEY=...          (Places + PageSpeed + CrUX enabled)
   SPYFU_API_KEY=...
   ANTHROPIC_API_KEY=...
   CALCOM_WEBHOOK_SECRET=...
   APP_BASE_URL=https://<your-vercel-domain>
   ```
3. **Vercel**: import the repo, root dir = repo root, build `npm run build`,
   output = `app`. Add the env vars above (Supabase service key as a *server* env).
4. **Railway**: new service from the same repo, start command
   `npm run start -w @scanner/worker`, add the same env vars.
5. **Cal.com**: add a webhook → `https://<vercel-domain>/api/booking-webhook`,
   event `BOOKING_CREATED`, copy the signing secret into `CALCOM_WEBHOOK_SECRET`.
6. **Smoke test**: `POST /api/scan {domain}` → report renders at `/r/{slug}`;
   a test booking writes a `leads` row.

## What still needs wiring at integration (code present, not live in dev)
- **pgmq transport**: dev uses an in-process queue; the worker loop + handler are
  identical. A `PgmqQueue` (Supabase pgmq read/delete) is the one piece to finish
  during the dry-run — the handler (`processScanJob`) does not change.
- **PDF**: `generateReportPdf` renders via Chromium; in prod point it at
  Browserless. In dev with no Chromium it falls back to HTML.
- **Notify-on-booking**: `/api/booking-webhook` has a TODO to ping Shawn (email/Slack).

## Pre-flight (run locally, all green today)
```
npm run typecheck && npm test && npm run build
npm run scan -- --domain=<a real med spa>
npm run report -- --domain=<...> --version=A
```

# CLAUDE.md — Med-Spa Growth Scanner

The software that powers the top of **The Compounding Method**'s funnel: give a
med-spa website URL → crawl it → score 5 growth pillars + a Compliance Surface →
an AI writes a short report → it shows on a **sparse public page whose only
button books a call**. Pre-scan target lists so each prospect's report is ready.

**`developer-technical-spec.md` is the source of truth.** When a shape, endpoint,
or formula is named there, match it exactly — don't improvise field names.

## Stack
- **Next.js on Vercel** — landing, `/r/[slug]` report page, thin API routes (enqueue/read only)
- **Node/TS worker on Railway** — runs the scan pipeline (the ONLY place heavy crawling happens)
- **Supabase** — Postgres + RLS, pgmq queue, pg_cron, Storage, Realtime
- **Browserless** — managed headless Chromium via Playwright (the crawler)
- **Google** — Places (discovery) + PageSpeed Insights + CrUX
- **SpyFu** — paid/organic/competitor enrichment, with graceful fallback
- **Anthropic `claude-haiku-4-5`** — report copy from verified findings only
- **Cal.com** — booking embed + webhook → leads

## Repo layout
```
/app                 Next.js (Vercel): landing, /r/[slug], /api/*, /admin
/worker              Node/TS (Railway): pgmq consumer running scan()
/packages/core       scan engine: crawl, detect, compliance, score, composeReport (pure, tested)
/supabase/migrations the schema (tech spec §3) — namespaced `scanner` schema
/output/reports      generated PDFs
prototype-reference/ the earlier generic prototype — PORT detector/speed code from here
```

## GOLDEN RULES (load-bearing — never break)
1. **Heavy crawl/scan runs ONLY in `/worker`**, never in Next.js API routes.
2. **Only `reports.client_payload` leaves the server.** No weights, detector
   internals, recommendations, or locked-pillar substance in it.
3. **Honesty:** every external figure is labeled with its **source** and, if
   modeled, **"estimated"**. The AI writer **invents no numbers** — if a value
   isn't detected, state what wasn't found.
4. **Compliance = structural-pattern flags, not legal verdicts.** Every finding
   carries confidence + disclaimer. Say **"Compliance Surface"** (never "Legal
   Exposure"), **"potential PHI context"** (never bare "PHI").
5. **The scorer is pure and unit-tested**, including the property that **no
   detector can inflate the Gap**.
6. **Public page is sparse:** score + gap + 5 pillar headlines + compliance flag
   + ONE CTA (book). No detailed findings, no PDF link, no share.

## Dev mode (credential-free)
We build WITHOUT production credentials. Every external dependency sits behind an
interface with a dev stand-in (in-memory store, fixtures, in-process queue),
switched by `BACKEND` / env. Integration = set keys + run the `scanner` SQL
migration + flip `BACKEND=supabase`. **No code changes at integration.**
See `INTEGRATION-STRATEGY.md`. Build order: `BUILD-SLICES.md`.

## How to work here
- **One slice at a time** (BUILD-SLICES.md S1–S21): implement → write tests → run → commit.
- Keep heavy work in `/worker`; API routes only enqueue and read.
- Tests required for the scorer (incl. no-gap-inflation) and every collector's fallback path.

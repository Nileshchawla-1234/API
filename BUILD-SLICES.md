# Build Slices — Med-Spa Growth Scanner

*The build broken into small, ordered, independently-shippable slices. Each is
one focused task → write tests → run Verify → commit → next. Follows the brand
`claude-code-build-playbook.md` task IDs (1.1–5.4) with our porting + blockers
annotated. Build top-to-bottom; the dependency column tells you what must exist first.*

Legend: **PORT** = adapt our existing code · **NEW** = build from scratch ·
🔑 = needs an external key · 🚧 = blocked (see §Blockers).

---

## Phase 0 — Prerequisites (do once, before any slice)

- [ ] Fresh git repo; drop in `developer-technical-spec.md` + `behind-the-score-report-versionA.html` (🚧 template needed from brand)
- [ ] Create accounts + keys: Supabase, Browserless, Google (Places+PageSpeed+CrUX enabled), SpyFu, Anthropic, Cal.com, Railway
- [ ] Generate `CLAUDE.md` (golden rules) — playbook kickoff prompt
- [ ] Keep our prototype repo alongside as the **port source**

---

## Phase 1 — Foundation (Day 1)

| # | Slice | Goal | Deps | Type | Keys | Verify |
|---|---|---|---|---|---|---|
| **S1** | Scaffold monorepo (1.1) | `/app` + `/worker` + `/packages/core`, scripts, vitest, supabase client | P0 | NEW | 🔑 Supabase | `npm run build` green; worker logs Supabase connection |
| **S2** | DB schema + migrations (1.2) | Full §3 DDL, enums, indexes, RLS, `get_report(slug)` RPC, pgmq + pg_cron | S1 | REWRITE (from our `schema.sql`) | 🔑 Supabase | migration applies; anon can only reach `get_report` |
| **S3** | Places discovery → targets (1.3) | `discoverMedSpas(city)`, `normalizeDomain`, dedupe upsert | S2 | NEW | 🔑 Google (Places) | `discover --city="Scottsdale, AZ"` inserts deduped targets |
| **S4** | Browserless crawler (1.4) | `crawl(domain)` via Playwright/wss; med-spa page set + raw capture | S1 | REWRITE (from `fetcher.ts`/`crawler.ts`) | 🔑 Browserless | `crawl --domain=<real spa>` prints pages/scripts/forms; no hard-fail on 404 |

---

## Phase 2 — Collectors & Detectors (Day 2) — *most porting happens here*

| # | Slice | Goal | Deps | Type | Keys | Verify |
|---|---|---|---|---|---|---|
| **S5** | Surface detectors (2.1) | `detectSignals(crawl)` → pixels, GA4/GTM, server-side(conf), call-tracking+vendor, **booking widget+vendor**, retargeting, schema, robots-AI, llms | S4 | **PORT** `tracking/aeo/seo/cro.ts` + extend signatures | — | 3 fixtures return correct bools/vendors; soft signals carry confidence |
| **S6** | Speed + CWV (2.2) | `getSpeed(url)` PSI mobile+desktop (perf/seo/a11y) + CrUX p75, lab fallback | S1 | **PORT** `pagespeed.ts`/`crux.ts` | 🔑 Google | real domain returns CWV; low-traffic falls back to lab |
| **S7** | Paid inference + SpyFu (2.3) | `inferPaid(crawl)` (free) + `enrichSpyFu(domain)` with §4d shape + clean fallback | S5 | PORT (inferPaid) / NEW (SpyFu) | 🔑 SpyFu (fallback if none) | data fills `spyfu`; forced error → `coverage:"none"`, scan still completes |
| **S8** | **Compliance detectors (2.4)** | `detectCompliance(crawl)` → §3 jsonb: PHI-context pixel, privacy, consent, ToS, TCPA, https/mixed, a11y; confidence on every signal | S4 | **NEW** (the differentiator) | — | high-risk fixture flags PHI-context (high)+missing consent; clean fixture low |

---

## Phase 3 — Scoring, Engine, Report (Day 3)

| # | Slice | Goal | Deps | Type | Keys | Verify |
|---|---|---|---|---|---|---|
| **S9** | Deterministic scorer (3.1) | 5 pillars from `scoring_config.json`, composite, **achievable(≤90)**, **gap**, **A–X tiering**, `compliance_risk_score`; property test: no detector inflates gap | S5–S8 | **REWRITE** (from `score.ts`) | — | `npm test` green incl. property test; fixture → sane pillars + tier |
| **S10** | `scan()` + worker + queue (3.2) | Pipeline writes scans/site_signals/5 pillar_results/compliance; pgmq consumer (vt=120,qty=4,≤60/min); pg_cron 30-day refresh | S2–S9 | REWRITE (from `engine.ts`) | 🔑 Supabase, Railway | `enqueue --domain=<spa>` → worker started→completed; rows present |
| **S11** | AI report + gate (3.3) | `composeReport` → `client_payload` (9 sections, sourced) + `internal_payload`; gate enforced; **no-fabrication eval** in CI | S10 | REWRITE (from `report.ts`) | 🔑 Anthropic | payload has 9 sections, no banned fields; eval passes; cost ~$0.01–0.03 |
| **S12** | Pre-scan batch (3.4) | `prescan --tier=A` enqueues a tier, prints summary | S10 | NEW | — | summary prints; `reports` rows have slugs |

---

## Phase 4 — Output & Page (Day 4) — *🚧 S13/S14 blocked on HTML template*

| # | Slice | Goal | Deps | Type | Keys | Verify |
|---|---|---|---|---|---|---|
| **S13** | 🚧 PDF Version A/B (4.1) | Puppeteer; A=full from template, B=sparse subset | S11, template | NEW | — | both PDFs open; A matches design; B sparse + notes block |
| **S14** | 🚧 Public `/r/[slug]` (4.2) | SSR from `get_report(slug)`; 9 sections, source chips, disclaimer, **one CTA**; 404 unknown | S2, S11, template | REWRITE (from our page) | — | slug renders; unknown 404s; no internal fields in source |
| **S15** | Landing + live-scan (4.3) | URL field → `POST /api/scan` (enqueue) → Realtime progress → `/r/{slug}`; rate-limit 5/IP/hr | S10, S14 | **PORT** our progress UX | — | new domain shows progress→report; abuse → 429 |
| **S16** | Deploy (4.4) | Vercel `/app`, Railway `/worker`, `DEPLOY.md` | S10, S14 | NEW | all | `/r/{slug}` live on Vercel; worker runs on Railway |

---

## Phase 5 — Loop & Hardening (Day 5)

| # | Slice | Goal | Deps | Type | Keys | Verify |
|---|---|---|---|---|---|---|
| **S17** | Report cache (5.1) | fresh(<30d) instant · stale serve+re-queue · miss live-scan; unit-test branches | S10 | NEW | — | fresh serves instant; >30d serves then re-queues |
| **S18** | Booking + capture (5.2) | `POST /api/booking-webhook` HMAC-verified → `leads`; Cal.com embed behind CTA; notify Shawn | S14 | NEW | 🔑 Cal.com | signed payload → lead row + notify; unsigned → 401 |
| **S19** | Admin-lite (5.3) | Auth-gated `/admin`: import URLs→enqueue, status board, export CSV | S2, S10 | NEW | 🔑 Supabase Auth | import enqueues+shows status; export returns CSV |
| **S20** | QA pass (5.4) | Run §11 Definition of Done on 3–5 real med spas | all | — | — | §11 checklist all green |

---

## Critical path & "start now" set

**Dependency spine:** S1 → S2 → S4 → S5/S8 → S9 → S10 → S11 → S14 → S16.

**Can start immediately (need only Supabase + Browserless + Google keys, NOT the HTML template):**
S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12 — i.e. **the entire engine end-to-end**.

**Parked until the HTML template arrives:** S13, S14 (and S15/S16/S18 which depend on S14).

> Strategy: build the whole engine (Phase 1–3) first — it's the highest-value
> work, needs no design template, and is where our porting pays off. The visual
> report (Phase 4) slots on top the moment Shawn provides
> `behind-the-score-report-versionA.html`.

## Blockers to clear (owner: Nilesh/Shawn)
1. 🚧 **`behind-the-score-report-versionA.html`** — blocks S13/S14/S15/S16/S18.
2. 🔑 Keys: Supabase, Browserless, Google (Places+PSI+CrUX), SpyFu, Anthropic, Cal.com, Railway.
3. Confirm SpyFu plan tier + per-endpoint rate limits.

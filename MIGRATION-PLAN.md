# Migration Plan — Generic Prototype → Med-Spa Growth Scanner (brand spec)

*How we get from the current single-app prototype to the architecture in
`developer-technical-spec.md` (source of truth), reusing what's good and
replacing what's off-contract. Decision: follow the spec fresh, port our
detector/speed code into `/packages/core`.*

---

## 1. Reusability summary

| Area | Reusable | Notes |
|---|---|---|
| Surface detectors (pixels, schema, robots-AI, llms.txt) | **~75%** | Extend signatures; add booking/server-side/runs-paid |
| Speed (PageSpeed + CrUX) | **~90%** | Add seo+accessibility categories, lab-fallback label |
| AI report generation pattern | **~30%** | Structure changes (client/internal payload gate + eval) |
| Scorer | **~20%** | Concept reused; 5 pillars + gap + tiering is a rewrite |
| Crawler (fetch+cheerio) | **~10%** | Replaced by Browserless/Playwright (executes JS) |
| Storage layer | **~5%** | Replaced by full Postgres schema + RLS |
| Category-content / progressive UX | partial | Drop category cards (off-brand); reuse progress UX for live scan |
| **Overall** | **~40%** | The detector library is the real carry-over |

---

## 2. Target repo structure (per brief §11)

```
/app                  Next.js (Vercel): landing, /r/[slug], thin /api/*, /admin
/worker               Node/TS (Railway): pgmq consumer running scan()
/packages/core        scan engine: crawl, detect, compliance, score, composeReport (pure, tested)
/supabase/migrations  full schema (spec §3)
/output/reports       generated PDFs
CLAUDE.md             golden rules
developer-technical-spec.md            (drop in repo root — source of truth)
behind-the-score-report-versionA.html  (NEEDED FROM BRAND — see §6 blockers)
```

---

## 3. File-by-file mapping (current → spec)

| Current file | Destination | Disposition | Effort |
|---|---|---|---|
| `detectors/tracking.ts` | `core/detect/signatures.ts` + `detectSignals` (§4e) | **PORT + extend**: add booking vendors (Square/Zenoti/Vagaro/Boulevard/Mindbody/Calendly/Acuity/Jane), server-side tag (`sgtm.`/`*.stape.io`), runs-paid (gclid/Meta Lead/ad LP). Keep confidence + "no clear signal" rule. | M |
| `detectors/aeo.ts` | folded into `detectSignals` | **PORT** (schema_types, robots_blocks_ai, llms_txt) nearly as-is | S |
| `detectors/seo.ts` | feeds Search pillar + crawl capture | **PORT** (JSON-LD extraction reused) | S |
| `detectors/cro.ts` | feeds Conversion pillar | **PORT** (forms, tel:, friction) | S |
| `detectors/siteType.ts` | `business_type` (local/national/ecom) | **ADAPT** — different enum; med spa usually `local` | S |
| `pagespeed.ts` | `core/collect/getSpeed` (§4b) | **PORT** — add `seo`+`accessibility` categories, keep desktop, add field data | S |
| `crux.ts` | `getSpeed` CrUX part (§4c) | **PORT** — add `source:"lab"` fallback label | S |
| `fetcher.ts` | `core/collect/crawl` (§4a) | **REWRITE** — Playwright over Browserless wss; capture dataLayer, headers, inline scripts, forms | L |
| `crawler.ts` | merged into `crawl(domain)` | **REWRITE** — med-spa page-match list; runs on worker only | M |
| `score.ts` | `core/score` (§5) | **REWRITE** — 5 pillars, bands from `scoring_config.json`, achievable/gap, A–X tiering, compliance_risk; no-gap-inflation property test | L |
| `report.ts` | `core/composeReport` (§6–§7) | **REWRITE** — `client_payload`/`internal_payload` split, 9 sections, no-fabrication CI eval | L |
| `engine.ts` | `core/scan(domain)` (§9) | **REWRITE** — new pipeline incl. compliance + SpyFu; writes all tables | M |
| `store/*` | `supabase/migrations` + service-key client | **REWRITE** per §3 (targets/scans/site_signals/pillar_results/reports/leads/scan_events) + RLS + `get_report(slug)` RPC | L |
| `content/*` (category cards) | — | **DROP** — off-brand (public page is sparse, no category cards) | — |
| `app/page.tsx`, `api/scan`, `api/scan/speed`, `api/classify` | landing + `/r/[slug]` + thin `/api/scan` (enqueue only) | **REWRITE** — sparse SSR page from `client_payload`, one Book CTA; v0 for UI | L |
| `cli.ts`, `seedCategories.ts` | dev CLIs (`crawl`/`enqueue`/`report`) | **ADAPT/DROP** | S |
| `supabase/schema.sql` | `supabase/migrations` | **REWRITE** — full §3 DDL, enums, RLS, pgmq, pg_cron | M |

---

## 4. Net-new modules (no current equivalent)

| Module | Spec | Why it matters | Effort |
|---|---|---|---|
| **`detectCompliance`** | §4f | THE differentiator: PHI-context pixel, privacy policy, cookie consent, TCPA, HTTPS/mixed, accessibility — with language hygiene + disclaimers | **L** |
| **Reputation pillar** | §4/§5 | 5th visible pillar; needs Places reviews data | M |
| **2 locked pillars (teasers)** | brief §4 | Lead Lifecycle + Monetization — teased only, the paid-diagnostic hook | S |
| **`enrichSpyFu`** | §4d | Client HAS the plan; est. spend/keywords/competitors with clean fallback | M |
| **Browserless crawler** | §4a | Real browser executes JS → catches client-injected pixels we currently miss | L |
| **Google Places discovery** | §1.3 | URL-in is fine, but the funnel pre-scans target lists by city | M |
| **pgmq worker + pg_cron** | §10 | Heavy scan off serverless; 30-day refresh | L |
| **PDF Version A/B (Puppeteer)** | §8 | Call deliverable (A full) + sparse follow-up (B) | L |
| **Cal.com booking webhook → leads** | §9 | The conversion + lead capture | M |
| **CI guardrails** | §5/§7 | No-gap-inflation property test + no-fabrication eval | M |

---

## 5. Build sequence (aligned to the playbook, annotated with our carry-over)

- **Day 1 — Foundation:** scaffold monorepo · full Supabase schema (§3) · Places discovery · Browserless crawl. *Carry-over: crawl page-match + capture logic informs the rewrite.*
- **Day 2 — Detectors:** `detectSignals` (**PORT** tracking/aeo/seo/cro) · `getSpeed` (**PORT** pagespeed/crux) · **`detectCompliance` (NEW)** · `enrichSpyFu` (NEW).
- **Day 3 — Scoring + engine:** scorer **REWRITE** (5 pillars + gap + tiering + property test) · `scan()` + worker/queue · `composeReport` **REWRITE** (gate + fabrication eval).
- **Day 4 — Output:** PDF A/B · public `/r/[slug]` (needs the HTML template) · landing + live-scan (**reuse our progress UX**).
- **Day 5 — Close the loop:** cache (fresh/stale/miss) · Cal.com booking → leads · admin-lite · QA on 3–5 real med spas.

---

## 6. Blockers & what's needed before building

1. **`behind-the-score-report-versionA.html`** — the report design template. We do **not** have it; it's required for the public page (§4.2) and both PDFs (§8). **Get from Shawn/brand.**
2. **Accounts / keys to procure** (beyond what we listed before):
   - `BROWSERLESS_TOKEN` (browserless.io)
   - `SPYFU_API_KEY` (client's Pro/Team plan)
   - `CALCOM_WEBHOOK_SECRET` (Cal.com)
   - `GOOGLE_API_KEY` with **Places + PageSpeed + CrUX** all enabled
   - Supabase project with **pgmq + pg_cron** extensions
   - **Railway** account (the worker host)
   - `ANTHROPIC_API_KEY` (already known)
3. **Confirm SpyFu plan tier + per-endpoint rate limits** (§4d).

---

## 7. Decisions already locked by the spec (don't re-litigate)
- Public page is **sparse**: score + gap + 5 pillar headlines + compliance flag + **one** Book CTA. Detailed findings/recommendations live in `internal_payload` (call-only). *(This supersedes our current "show all findings" page.)*
- Only `reports.client_payload` leaves the server.
- Compliance = **flags with confidence + disclaimer**, never legal verdicts; "Compliance Surface" not "Legal Exposure"; "potential PHI context" not "PHI".
- AI writer **invents no numbers**; absent value → state what wasn't detected.
- Heavy work **only** on the Railway worker.
- Scorer is **pure + unit-tested**, incl. no-gap-inflation.

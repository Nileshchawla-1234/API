# Integration Strategy — Credential-Free Development

*Constraint: we do NOT get production storage credentials during the build.
The hosted website + its Supabase belong to the client; we only get keys and
SQL access at FINAL INTEGRATION. So we build everything to run and be provably
correct without any prod credential, and make integration a thin, code-free step.*

---

## 1. Core principle

> Every external dependency sits behind an **interface** with a **dev stand-in**.
> The full pipeline runs on stand-ins + fixtures. Integration = set env vars +
> run one SQL migration. **No code changes at integration.**

A single `BACKEND`/env switch flips each dependency from dev stand-in → real
service. Nothing in the engine logic knows the difference.

---

## 2. Every dependency: prod vs dev stand-in

| Dependency | Production (at integration) | Dev stand-in (no creds, now) | Proven by |
|---|---|---|---|
| **Storage** (Supabase Postgres) | client's hosted Supabase | in-memory + file `Store` impl (we already have the interface) | `Store` unit tests; SQL validated separately (see §4) |
| **Queue** (pgmq) | Supabase pgmq | in-process queue (same `enqueue/consume` interface) | worker drains both identically |
| **Crawler** (Browserless) | Browserless wss | local Playwright **or** saved HTML fixtures | fixture-driven detector tests |
| **Speed** (PageSpeed/CrUX) | Google API | recorded JSON response fixtures | `getSpeed` tests on fixtures |
| **SpyFu** | SpyFu API | fixtures + forced `coverage:"none"` fallback | fallback test (scan still completes) |
| **AI report** (Anthropic Haiku) | Haiku | deterministic rules fallback + fixtures | no-fabrication eval on fixtures |
| **Booking** (Cal.com) | signed webhook | self-signed test payload | webhook→lead test |
| **Discovery** (Google Places) | Places API | fixture city result | `normalizeDomain` + dedupe tests |

Result: `npm test` and a local `scan(domain)` run **fully green with zero live keys**.

---

## 3. Database: safe, additive, namespaced (so integration can't break their site)

Because our SQL runs on the client's **existing** Supabase at integration:

- **All our tables live in a dedicated `scanner` schema**, never `public` → zero
  collision with whatever their website already has.
- Migration is **idempotent** (`create ... if not exists`) and **reversible** (a
  `down` that drops only the `scanner` schema).
- **Extensions** (`pgmq`, `pg_cron`) are called out separately — enabling them
  needs admin rights, so that's an explicit integration step the client runs.
- RLS + the `get_report(slug)` RPC are scoped to the `scanner` schema.
- We hand over **one reviewed `.sql` file**; the client runs it in their SQL editor.

> Assumption: the scanner persists into the client's Supabase. If instead the
> tool gets its **own** Supabase project, the same namespaced migration still
> applies unchanged — only the connection string differs.

---

## 4. How we validate the *real* SQL without their prod

The in-memory store proves the app logic; we still must prove the actual SQL +
RLS + RPC before touching prod. Options (pick in §Decision):

- **A — Local Supabase (Docker):** `supabase start` runs the full stack locally;
  we apply the migration + test RLS/RPC against real Postgres. Highest fidelity. Needs Docker.
- **B — Throwaway dev Supabase project:** a free, separate cloud project (NOT
  prod) to apply + test the migration. No Docker; 5-min setup by you.
- **C — Mock-only + SQL lint:** ship the migration validated by parsing/lint and
  the in-memory store; first real run is at integration. Fastest, lowest fidelity.

---

## 5. "Everything working" — the bar before integration

- [ ] `npm test` green: detectors, scorer (incl. no-gap-inflation), compliance, every fallback, fabrication eval.
- [ ] `scan(domain)` runs end-to-end on dev backend → writes rows to dev store → report payload assembles.
- [ ] Worker drains the in-process queue exactly as it will drain pgmq.
- [ ] Real SQL migration applied + RLS/RPC verified (via §4 A or B).
- [ ] Smoke demo on 3–5 saved real-med-spa fixtures.

---

## 6. Integration checklist (the ONLY steps that touch prod — code-free)

1. Set env vars in **worker (Railway)** + **app (Vercel)**: all keys.
2. Run our **`scanner` migration** in the client's Supabase SQL editor.
3. Enable **`pgmq` + `pg_cron`** extensions (admin).
4. Set `BACKEND=supabase`; deploy worker + app.
5. Smoke test: enqueue 1 domain → report renders at `/r/{slug}` → a test Cal.com booking writes a lead.

---

## 7. Impact on the build slices

No new slices — this **layers onto** BUILD-SLICES.md:
- S2 (schema): write as a namespaced `scanner` migration + provide the in-memory `Store`.
- S4/S6/S7/S11 (collectors): each ships with fixtures + its fallback (already the spec's design).
- S10 (worker/queue): in-process queue impl behind the same interface as pgmq.
- A final **S21 — Integration dry-run**: run the §6 checklist against §4-A/B to rehearse before the real thing.

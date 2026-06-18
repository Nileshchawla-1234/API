import type { ClientPayload } from "../types";
import { hasNoFabrication } from "./guardrail";

// Optional AI copy pass (spec §7). Rephrases finding text + CTA for punch, with
// Haiku, temperature 0.2. EVERY rewritten string is validated against the source
// facts — any number not present in the input → the original is kept. No key /
// error → returns the payload unchanged (deterministic copy stands).

const PROMPT_VERSION = "haiku-copy-v1";

export interface EnhanceResult {
  payload: ClientPayload;
  model: string | null;
  promptVersion: string;
  applied: boolean;
}

export async function enhanceReportCopy(
  payload: ClientPayload,
  apiKey?: string,
  model = "claude-haiku-4-5"
): Promise<EnhanceResult> {
  if (!apiKey) return { payload, model: null, promptVersion: "rules-v1", applied: false };

  // The only facts the writer is allowed to reference.
  const facts = JSON.stringify({
    score: payload.score,
    pillars: payload.pillars.map((p) => ({ key: p.key, score: p.score, findings: p.findings.map((f) => f.text) })),
    compliance: payload.compliance.rows.map((r) => r.signal),
  });

  const items = payload.pillars.flatMap((p, pi) =>
    p.findings.map((f, fi) => ({ id: `${pi}.${fi}`, text: f.text }))
  );

  const prompt = `You phrase facts already established. Never introduce a number, benchmark, or claim not present in the input. If a value is absent, state what was not detected — do not estimate.

Rewrite each finding to be crisp and client-ready (one short sentence), keeping ALL numbers identical. Return STRICT JSON: {"items":[{"id":string,"text":string}], "cta_headline":string, "cta_body":string}.

FACTS:
${facts}

FINDINGS TO REWRITE:
${JSON.stringify(items)}

CURRENT CTA: ${JSON.stringify({ headline: payload.cta.headline, body: payload.cta.body })}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 1500, temperature: 0.2, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) return { payload, model: null, promptVersion: "rules-v1", applied: false };
    const json: any = await res.json();
    const text: string = json?.content?.[0]?.text ?? "";
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}");

    const rewritten = new Map<string, string>();
    for (const it of parsed.items ?? []) {
      if (typeof it?.id === "string" && typeof it?.text === "string" && hasNoFabrication(facts, it.text).ok) {
        rewritten.set(it.id, it.text);
      }
    }

    const next: ClientPayload = {
      ...payload,
      pillars: payload.pillars.map((p, pi) => ({
        ...p,
        findings: p.findings.map((f, fi) => ({ ...f, text: rewritten.get(`${pi}.${fi}`) ?? f.text })),
      })),
      cta: {
        ...payload.cta,
        headline: typeof parsed.cta_headline === "string" && hasNoFabrication(facts, parsed.cta_headline).ok ? parsed.cta_headline : payload.cta.headline,
        body: typeof parsed.cta_body === "string" && hasNoFabrication(facts, parsed.cta_body).ok ? parsed.cta_body : payload.cta.body,
      },
    };
    return { payload: next, model, promptVersion: PROMPT_VERSION, applied: true };
  } catch {
    return { payload, model: null, promptVersion: "rules-v1", applied: false };
  }
}

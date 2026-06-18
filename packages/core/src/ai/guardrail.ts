// No-fabrication guardrail (spec §7): the AI copy writer may only rephrase facts
// already present — it must NEVER introduce a number/benchmark not in its input.
// These helpers are pure and unit-tested, and gate every AI rewrite at runtime.

/** Extract normalized numeric tokens (commas stripped) from text. */
export function extractNumbers(text: string): Set<string> {
  const out = new Set<string>();
  const cleaned = text.replace(/,(?=\d)/g, ""); // 1,240 → 1240
  for (const m of cleaned.matchAll(/\d+(?:\.\d+)?/g)) out.add(m[0].replace(/\.0+$/, ""));
  return out;
}

/** True iff every number in `output` also appears in `inputFacts`. */
export function hasNoFabrication(
  inputFacts: string,
  output: string
): { ok: boolean; offending: string[] } {
  const allowed = extractNumbers(inputFacts);
  const offending: string[] = [];
  for (const n of extractNumbers(output)) {
    if (!allowed.has(n)) offending.push(n);
  }
  return { ok: offending.length === 0, offending };
}

// Keys the gate forbids in client_payload (spec §6 / brief §5.3).
const BANNED_CLIENT_KEYS = ["weight", "weights", "internal", "recommendation", "recommendations", "how_to_fix", "raw_signals", "pillar_signals"];

/** Recursively assert a client_payload contains none of the banned keys. */
export function assertGated(clientPayload: unknown): { ok: boolean; offending: string[] } {
  const offending: string[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object") {
      for (const k of Object.keys(node as Record<string, unknown>)) {
        if (BANNED_CLIENT_KEYS.includes(k.toLowerCase())) offending.push(k);
        walk((node as Record<string, unknown>)[k]);
      }
    }
  };
  walk(clientPayload);
  return { ok: offending.length === 0, offending };
}

// Collect schema.org @type values from parsed JSON-LD blocks (recursively,
// including @graph). Used by detectSignals + the AI pillar.

export function collectSchemaTypes(jsonLdBlocks: unknown[]): string[] {
  const out = new Set<string>();
  for (const block of jsonLdBlocks) walk(block, out);
  return [...out];
}

function walk(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) {
    for (const n of node) walk(n, out);
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const t = obj["@type"];
    if (typeof t === "string") out.add(t);
    else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && out.add(x));
    if (obj["@graph"]) walk(obj["@graph"], out);
  }
}

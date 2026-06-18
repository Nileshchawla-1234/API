// Speed + Core Web Vitals (spec §4b–§4c). PageSpeed Insights v5 (lab + scores)
// for mobile & desktop, CrUX for real-user p75 with a labeled lab fallback.
// Credential-free: no GOOGLE_API_KEY → returns available:false with a note.

export interface LighthouseScores {
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  lcpMs: number | null;
  interactiveMs: number | null;
  cls: number | null;
  tbtMs: number | null;
}

export interface CoreWebVitals {
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
  source: "field" | "lab";
}

export interface SpeedResult {
  available: boolean;
  mobile: LighthouseScores;
  desktop: LighthouseScores;
  cwv: CoreWebVitals | null;
  note?: string;
}

const PSI = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const CRUX = "https://chromeuxreport.googleapis.com/v1/records:queryRecord";

const cache = new Map<string, { at: number; value: SpeedResult }>();
const TTL_MS = 6 * 60 * 60 * 1000; // ~6h

const emptyScores = (): LighthouseScores => ({
  performance: null, seo: null, accessibility: null,
  lcpMs: null, interactiveMs: null, cls: null, tbtMs: null,
});

function audit(lh: any, id: string): number | null {
  const v = lh?.audits?.[id]?.numericValue;
  return typeof v === "number" ? Math.round(v) : null;
}

function catScore(lh: any, cat: string): number | null {
  const s = lh?.categories?.[cat]?.score;
  return typeof s === "number" ? Math.round(s * 100) : null;
}

async function psi(url: string, strategy: "mobile" | "desktop", key?: string): Promise<LighthouseScores> {
  const params = new URLSearchParams({ url, strategy });
  for (const c of ["performance", "seo", "accessibility"]) params.append("category", c);
  if (key) params.set("key", key);
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 60000);
    const res = await fetch(`${PSI}?${params}`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return emptyScores();
    const lh = ((await res.json()) as any).lighthouseResult;
    if (!lh) return emptyScores();
    const cls = lh?.audits?.["cumulative-layout-shift"]?.numericValue;
    return {
      performance: catScore(lh, "performance"),
      seo: catScore(lh, "seo"),
      accessibility: catScore(lh, "accessibility"),
      lcpMs: audit(lh, "largest-contentful-paint"),
      interactiveMs: audit(lh, "interactive"),
      cls: typeof cls === "number" ? Number(cls.toFixed(3)) : null,
      tbtMs: audit(lh, "total-blocking-time"),
    };
  } catch {
    return emptyScores();
  }
}

async function crux(url: string, key: string): Promise<CoreWebVitals | null> {
  const query = async (body: Record<string, unknown>) => {
    try {
      const res = await fetch(`${CRUX}?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, formFactor: "PHONE" }),
      });
      if (!res.ok) return null;
      return ((await res.json()) as any)?.record?.metrics ?? null;
    } catch {
      return null;
    }
  };
  const m = (await query({ url })) ?? (await query({ origin: safeOrigin(url) }));
  if (!m) return null;
  const p75 = (metric: any) => {
    const v = metric?.percentiles?.p75;
    return v === undefined || v === null ? null : Number(v);
  };
  return {
    lcpMs: p75(m.largest_contentful_paint),
    inpMs: p75(m.interaction_to_next_paint),
    cls: p75(m.cumulative_layout_shift),
    source: "field",
  };
}

export async function getSpeed(url: string, apiKey?: string): Promise<SpeedResult> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  if (!apiKey) {
    return {
      available: false,
      mobile: emptyScores(),
      desktop: emptyScores(),
      cwv: null,
      note: "GOOGLE_API_KEY not set — speed skipped (dev mode)",
    };
  }

  const [mobile, desktop, fieldCwv] = await Promise.all([
    psi(url, "mobile", apiKey),
    psi(url, "desktop", apiKey),
    crux(url, apiKey),
  ]);

  // CrUX field data preferred; fall back to mobile lab values, labeled.
  const cwv: CoreWebVitals | null =
    fieldCwv ??
    (mobile.lcpMs !== null
      ? { lcpMs: mobile.lcpMs, inpMs: mobile.interactiveMs, cls: mobile.cls, source: "lab" }
      : null);

  const value: SpeedResult = {
    available: mobile.performance !== null || desktop.performance !== null,
    mobile,
    desktop,
    cwv,
  };
  cache.set(url, { at: Date.now(), value });
  return value;
}

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

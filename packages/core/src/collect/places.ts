import { normalizeDomain } from "../util/domain";
import type { TargetInput } from "../types";

// Google Places (New) Text Search. We request website + phone directly in the
// field mask, so no separate Place Details round-trip is needed.

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

interface PlaceLite {
  displayName?: { text?: string };
  websiteUri?: string;
  nationalPhoneNumber?: string;
  id?: string;
}

/** Pure: map + dedupe Places results into target rows. Unit-tested. */
export function placesToTargets(places: PlaceLite[]): TargetInput[] {
  const byDomain = new Map<string, TargetInput>();
  for (const p of places) {
    if (!p.websiteUri) continue; // no site → can't scan → skip
    const domain = normalizeDomain(p.websiteUri);
    if (!domain || byDomain.has(domain)) continue;
    byDomain.set(domain, {
      business_name: p.displayName?.text,
      domain,
      phone: p.nationalPhoneNumber,
      place_id: p.id,
    });
  }
  return [...byDomain.values()];
}

/**
 * Discover med spas in a city. Returns [] (with a note) when no API key is set,
 * so the build/tests run credential-free; real discovery happens at integration.
 */
export async function discoverMedSpas(
  city: string,
  apiKey?: string
): Promise<{ targets: TargetInput[]; note?: string }> {
  if (!apiKey) {
    return { targets: [], note: "GOOGLE_API_KEY not set — discovery skipped (dev mode)" };
  }
  try {
    const res = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.websiteUri,places.nationalPhoneNumber",
      },
      body: JSON.stringify({ textQuery: `med spa in ${city}` }),
    });
    if (!res.ok) return { targets: [], note: `Places HTTP ${res.status}` };
    const json = (await res.json()) as { places?: PlaceLite[] };
    return { targets: placesToTargets(json.places ?? []) };
  } catch (err) {
    return { targets: [], note: `Places error: ${(err as Error).message}` };
  }
}

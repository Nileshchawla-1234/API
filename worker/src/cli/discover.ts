// npm run discover -- --city="Scottsdale, AZ"
import { discoverMedSpas, getStore, env } from "@scanner/core";

try {
  process.loadEnvFile?.(".env");
} catch {}

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=").slice(1).join("=").replace(/^["']|["']$/g, "");
}

async function main() {
  const city = arg("city");
  if (!city) {
    console.error('Usage: npm run discover -- --city="Scottsdale, AZ"');
    process.exit(1);
  }

  const { targets, note } = await discoverMedSpas(city, env.googleApiKey);
  if (note) console.log(`[discover] ${note}`);

  const store = getStore();
  const n = await store.upsertTargets(targets);
  console.log(`[discover] ${city}: found ${targets.length}, upserted ${n} into targets (${store.kind})`);
}

main().catch((e) => {
  console.error("[discover] failed:", e.message);
  process.exit(1);
});

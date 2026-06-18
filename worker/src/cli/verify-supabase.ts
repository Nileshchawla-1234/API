// npm run verify:supabase
// Run this AFTER (1) pasting the service_role key into .env and (2) running
// supabase/migrations/0001_init.sql in the Supabase SQL editor.
// It connects with your key (which stays on your machine) and checks the
// scanner schema is reachable. Share only the ✅/❌ output — never the key.
import { createSupabaseStore } from "@scanner/core";

try {
  process.loadEnvFile?.(".env");
} catch {}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error("❌ Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env first.");
    process.exit(1);
  }
  if (key.startsWith("sb_publishable_")) {
    console.error("❌ That's the publishable (anon) key. Use the secret service_role key.");
    process.exit(1);
  }

  console.log(`Connecting to ${url} ...`);
  const store = createSupabaseStore(url, key);
  try {
    await store.init(); // healthCheck: SELECT from scanner.scans
    console.log("✅ Connected and the `scanner` schema is reachable.");
    console.log("✅ Service key works. Ready to flip BACKEND=supabase.");
  } catch (e) {
    const msg = (e as Error).message;
    console.error("❌ " + msg);
    if (/relation|schema|does not exist/i.test(msg)) {
      console.error("   → Run supabase/migrations/0001_init.sql in the SQL editor, then retry.");
    }
    process.exit(1);
  }
}

main();

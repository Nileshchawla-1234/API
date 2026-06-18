// npm run crawl -- --domain=example.com
import { crawl, env } from "@scanner/core";

try {
  process.loadEnvFile?.(".env");
} catch {}

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=").slice(1).join("=").replace(/^["']|["']$/g, "");
}

async function main() {
  const domain = arg("domain");
  if (!domain) {
    console.error("Usage: npm run crawl -- --domain=example.com");
    process.exit(1);
  }
  const result = await crawl(domain, { browserlessToken: env.browserlessToken, browserlessUrl: env.browserlessUrl });
  console.log(`[crawl] ${result.domain} via ${result.via} → ${result.pages.length} page(s)`);
  for (const p of result.pages) {
    console.log(`  ${p.status}  ${p.url}  (scripts:${p.scripts.length} forms:${p.forms.length} jsonld:${p.jsonLd.length} tel:${p.telLinks.length})`);
  }
  console.log(`  robots:${!!result.robotsTxt} sitemap:${!!result.sitemapXml} llms:${!!result.llmsTxt} privacy:${!!result.privacyHtml} terms:${!!result.termsHtml}`);
  if (result.errors.length) console.log(`  errors: ${result.errors.join("; ")}`);
}

main().catch((e) => {
  console.error("[crawl] failed:", e.message);
  process.exit(1);
});

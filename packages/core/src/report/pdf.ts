import { renderReportHtml, type ReportVersion } from "./template";
import type { ClientPayload } from "../types";

export interface RenderedReport {
  html: string;
  pdf: Uint8Array | null; // null when no Chromium is available (dev fallback)
  rendered: "pdf" | "html";
}

/**
 * Render a report to PDF (spec §8) via headless Chromium. Falls back to the HTML
 * string when no browser is installed (dev), so this never hard-fails. In
 * production the worker/Browserless provides Chromium.
 */
export async function generateReportPdf(
  payload: ClientPayload,
  version: ReportVersion = "A"
): Promise<RenderedReport> {
  const html = renderReportHtml(payload, version);
  try {
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle" });
      const pdf = await page.pdf({ format: "Letter", printBackground: true });
      return { html, pdf, rendered: "pdf" };
    } finally {
      await browser.close().catch(() => {});
    }
  } catch {
    return { html, pdf: null, rendered: "html" };
  }
}

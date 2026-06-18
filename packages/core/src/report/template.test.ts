import { describe, expect, it } from "vitest";
import { renderReportHtml } from "./template";
import type { ClientPayload } from "../types";

const payload: ClientPayload = {
  header: { domain: "spa.com", business_name: "Radiance Med Spa", location: "Scottsdale, AZ", scan_date: "2026-06-15T00:00:00Z", tier: "A" },
  score: { composite: 44, achievable: 90, gap: 46 },
  pillars: [
    { key: "paid", score: 38, rag: "crit", findings: [{ text: "No server-side conversion signal detected", source: "crawl" }], target: "What 100 looks like: full-funnel tracking." },
    { key: "conversion", score: 65, rag: "warn", findings: [], target: "What 100 looks like: sub-2.5s mobile LCP." },
  ],
  locked: [{ name: "Lead Lifecycle", tease: "End-to-end lead handling." }, { name: "Monetization & Retention", tease: "LTV and rebooking." }],
  compliance: { risk: 72, rows: [{ signal: "Potential PHI context: ad pixel on a treatment page", observed: "present", tier: 1, confidence: "high" }], disclaimer: "This is a structural pattern flag, not a legal determination." },
  cwv: [{ metric: "LCP", good: "≤2.5s", actual: "5.6s" }],
  cta: { headline: "See what's behind your score.", body: "Book a call.", button: "Book your Behind-the-Score call" },
  footer_disclaimer: "Marketing operations firm, not a law firm.",
};

describe("renderReportHtml", () => {
  it("Version A includes findings, compliance rows, and CWV", () => {
    const html = renderReportHtml(payload, "A");
    expect(html).toContain("Radiance Med Spa");
    expect(html).toContain("No server-side conversion signal detected");
    expect(html).toContain("Potential PHI context");
    expect(html).toContain("Core Web Vitals");
    expect(html).not.toMatch(/legal exposure/i);
  });

  it("Version B is sparser — no findings, has a discussion-notes block", () => {
    const html = renderReportHtml(payload, "B");
    expect(html).not.toContain("No server-side conversion signal detected");
    expect(html).toContain("Discussion notes");
  });

  it("escapes user-controlled content", () => {
    const evil = { ...payload, header: { ...payload.header, business_name: "<script>alert(1)</script>" } };
    expect(renderReportHtml(evil, "A")).not.toContain("<script>alert(1)</script>");
  });
});

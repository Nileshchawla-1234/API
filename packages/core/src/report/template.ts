import type { ClientPayload, PillarKind } from "../types";

// The report template (the "behind-the-score" design), as a pure function that
// hydrates a full standalone HTML document from a client_payload. Drives BOTH
// the PDF (S13) and the static reference file. Version A = full (9 sections);
// Version B = deliberately sparse follow-up (no findings/recommendations).

export type ReportVersion = "A" | "B";

const PILLAR_LABEL: Record<PillarKind, string> = {
  paid: "Paid Acquisition",
  search: "Search & Local Presence",
  ai: "AI Visibility Readiness",
  reputation: "Reputation Surface",
  conversion: "Conversion Infrastructure",
};

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

const STYLE = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1f2b;background:#fff;line-height:1.5}
.page{max-width:760px;margin:0 auto;padding:40px}
.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #eef0f4;padding-bottom:18px}
.domain{font-size:24px;font-weight:800}
.muted{color:#6b7280;font-size:13px}
.tier{padding:6px 12px;border-radius:999px;font-weight:800;font-size:13px}
.tier.A{background:#fde2e2;color:#b42318}.tier.B{background:#fdf0d5;color:#b25e09}
.tier.C,.tier.D{background:#eef0f4;color:#6b7280}
.score{display:flex;align-items:center;gap:24px;margin:28px 0}
.score .big{font-size:64px;font-weight:800;line-height:1}
.gap{color:#b25e09;font-weight:600}
h2{font-size:13px;letter-spacing:1.3px;text-transform:uppercase;color:#6b7280;margin:30px 0 12px}
.pillar{border:1px solid #eef0f4;border-radius:10px;padding:14px 16px;margin-bottom:10px}
.ptop{display:flex;align-items:center;gap:10px}
.dot{width:10px;height:10px;border-radius:50%}
.crit{background:#e5484d}.warn{background:#e0a116}.ok{background:#30a46c}
.bg-crit{background:#e5484d}.bg-warn{background:#e0a116}.bg-ok{background:#30a46c}
.plabel{flex:1;font-weight:700}.pscore{color:#6b7280}
.bar{height:7px;background:#eef0f4;border-radius:5px;overflow:hidden;margin:9px 0}
.bar i{display:block;height:100%}
.findings{margin:6px 0 4px 18px;font-size:13px}
.src{color:#9aa1ad;font-size:10px;text-transform:uppercase}
.target{color:#6b7280;font-size:12px;font-style:italic}
.locked-grid{display:flex;gap:12px}
.locked{flex:1;border:1px dashed #d4d8e0;border-radius:10px;padding:14px;background:#fafbfc}
.comp{border:1px solid #eef0f4;border-radius:10px;padding:14px 16px}
.comp li{list-style:none;padding:7px 0;border-bottom:1px solid #f1f3f7;font-size:13px}
.chip{display:inline-block;padding:1px 7px;border-radius:6px;font-size:11px;font-weight:700;margin-right:8px;background:#eef0f4;color:#6b7280}
.disclaimer{color:#9aa1ad;font-size:11px;border-top:1px solid #eef0f4;margin-top:10px;padding-top:8px}
table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:7px 9px;border-bottom:1px solid #eef0f4;font-size:13px}
.cta{margin-top:34px;padding:24px;text-align:center;background:#0b1f17;color:#fff;border-radius:14px}
.btn{display:inline-block;margin-top:12px;padding:11px 20px;background:#30a46c;color:#fff;border-radius:9px;font-weight:700}
.notes{border:1px dashed #d4d8e0;border-radius:10px;padding:16px;min-height:90px;color:#9aa1ad}
.footer{color:#9aa1ad;font-size:11px;text-align:center;margin-top:24px}
`;

function pillarBlock(pl: ClientPayload["pillars"][number], showFindings: boolean): string {
  const findings =
    showFindings && pl.findings.length
      ? `<ul class="findings">${pl.findings.map((f) => `<li>${esc(f.text)} <span class="src">${esc(f.source)}</span></li>`).join("")}</ul>`
      : "";
  return `<div class="pillar">
    <div class="ptop"><span class="dot ${pl.rag}"></span><span class="plabel">${esc(PILLAR_LABEL[pl.key] ?? pl.key)}</span><span class="pscore">${pl.score}/100</span></div>
    <div class="bar"><i class="bg-${pl.rag}" style="width:${pl.score}%"></i></div>
    ${findings}
    <div class="target">${esc(pl.target)}</div>
  </div>`;
}

export function renderReportHtml(p: ClientPayload, version: ReportVersion = "A"): string {
  const full = version === "A";

  const compliance = full
    ? `<h2>Compliance Surface</h2><section class="comp">
        <div style="font-size:18px;margin-bottom:10px">Risk score <strong>${p.compliance.risk}</strong>/100</div>
        ${p.compliance.rows.length
          ? `<ul style="padding:0">${p.compliance.rows.map((r) => `<li><span class="chip">T${r.tier}</span>${esc(r.signal)}: <em>${esc(r.observed)}</em> (${esc(r.confidence)} confidence)</li>`).join("")}</ul>`
          : `<div class="muted">No high-risk tracking patterns detected on the public site.</div>`}
        <div class="disclaimer">${esc(p.compliance.disclaimer)}</div>
      </section>`
    : `<h2>Compliance Surface</h2><section class="comp"><div>Risk score <strong>${p.compliance.risk}</strong>/100. Full pattern detail reviewed live on the call.</div><div class="disclaimer">${esc(p.compliance.disclaimer)}</div></section>`;

  const cwv =
    full && p.cwv.length
      ? `<h2>Core Web Vitals</h2><table><tr><th>Metric</th><th>Good</th><th>Yours</th></tr>${p.cwv.map((c) => `<tr><td>${esc(c.metric)}</td><td class="muted">${esc(c.good)}</td><td><strong>${esc(c.actual)}</strong></td></tr>`).join("")}</table>`
      : "";

  const competitors =
    full && p.competitors?.rows.length
      ? `<h2>Competitors <span class="src">${esc(p.competitors.source)}</span></h2><ul class="findings">${p.competitors.rows.map((r) => `<li>${esc((r as { name?: string }).name ?? "competitor")}</li>`).join("")}</ul>`
      : "";

  const notes = !full ? `<h2>Discussion notes</h2><div class="notes">&nbsp;</div>` : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>Behind-the-Score · ${esc(p.header.domain)}</title><style>${STYLE}</style></head>
<body><div class="page">
  <div class="head">
    <div><div class="domain">${esc(p.header.business_name || p.header.domain)}</div>
      <div class="muted">${esc(p.header.domain)}${p.header.location ? " · " + esc(p.header.location) : ""} · ${esc(p.header.scan_date.slice(0, 10))}</div></div>
    <span class="tier ${esc(p.header.tier)}">Tier ${esc(p.header.tier)}</span>
  </div>

  <div class="score">
    <div class="big">${p.score.composite}<span style="font-size:24px;color:#9aa1ad">/100</span></div>
    <div><div style="font-weight:600">Compounding Score</div>
      <div class="gap">Gap to achievable: ${p.score.gap} (achievable ${p.score.achievable})</div></div>
  </div>

  <h2>Five Growth Pillars</h2>
  ${p.pillars.map((pl) => pillarBlock(pl, full)).join("")}

  <h2>Reserved for your diagnostic</h2>
  <div class="locked-grid">${p.locked.map((l) => `<div class="locked"><strong>🔒 ${esc(l.name)}</strong><div class="muted">${esc(l.tease)}</div></div>`).join("")}</div>

  ${compliance}
  ${cwv}
  ${competitors}
  ${notes}

  <div class="cta"><strong>${esc(p.cta.headline)}</strong><div class="muted" style="color:#c7d0c9">${esc(p.cta.body)}</div><span class="btn">${esc(p.cta.button)}</span></div>
  <div class="footer">${esc(p.footer_disclaimer)}</div>
</div></body></html>`;
}

import { notFound } from "next/navigation";
import { getStore } from "@scanner/core";
import type { ClientPayload } from "@scanner/core";
import { ReportView, type ReportStyles } from "../../_report/ReportView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// V1 (Console) report theme — maps the renderer's keys to existing global classes.
const v1: ReportStyles = {
  root: "report", bg: "site-bg", inner: "", kicker: "kicker", head: "rpt-head",
  domain: "rpt-domain", meta: "muted", tier: "tier", tier_A: "tier-A", tier_B: "tier-B", tier_C: "tier-C", tier_D: "tier-D",
  scoreWrap: "score-block", scoreNum: "score-big", scoreDen: "score-den", scoreLabel: "", gap: "gap", h2: "rpt-h2",
  pillar: "pillar", pillarTop: "pillar-top", rag: "rag", rag_crit: "rag-crit", rag_warn: "rag-warn", rag_ok: "rag-ok",
  pillarLabel: "pillar-label", pillarScore: "pillar-score", bar: "bar", barFill: "bar-fill", barFill_crit: "rag-bg-crit", barFill_warn: "rag-bg-warn", barFill_ok: "rag-bg-ok",
  findings: "findings", src: "src", target: "target", lockedGrid: "locked-grid", locked: "locked", lockIcon: "lock-icon",
  compliance: "compliance", risk: "risk", compRows: "comp-rows", chip: "chip", chip_t1: "tier1", chip_t2: "", conf: "conf",
  disclaimer: "disclaimer", cwv: "cwv", cta: "cta", ctaBtn: "btn", footer: "footer-disc",
};

export default async function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const payload = (await getStore().getReportBySlug(slug)) as ClientPayload | null;
  if (!payload) notFound();
  return <ReportView payload={payload} styles={v1} />;
}

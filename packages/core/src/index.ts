// @scanner/core — the pure, testable scan engine.
// Slices: S4 crawl · S5 detectSignals · S6 getSpeed · S7 inferPaid/enrichSpyFu
//         S8 detectCompliance · S9 score · S10 scan() · S11 composeReport

export * from "./env";
export * from "./types";
export * from "./store";
export * from "./util/domain";
export * from "./collect/places";
export * from "./collect/crawl";
export { parsePage, discoverLinks } from "./collect/parse";
export * from "./collect/speed";
export * from "./collect/spyfu";
export { detectSignals } from "./detect/signals";
export { inferPaid } from "./detect/paid";
export { detectCompliance } from "./detect/compliance";
export { score, type ScoreInput, type ScoreResult } from "./score";
export { composeReport, type ComposeInput, type ComposeResult } from "./report";
export { scanDomain, type ScanOptions } from "./scan";
export { getQueue, __resetQueue, type Queue, type ScanJob } from "./queue/index";
export { processScanJob } from "./runJob";
export { enhanceReportCopy } from "./ai/copy";
export { hasNoFabrication, extractNumbers, assertGated } from "./ai/guardrail";
export { cacheDecision, type CacheDecision } from "./cache";
export { renderReportHtml, type ReportVersion } from "./report/template";
export { generateReportPdf, type RenderedReport } from "./report/pdf";
export { verifyCalcomSignature, mapBookingToLead } from "./booking";
export { collectSchemaTypes } from "./detect/schema";
export { robotsBlocksAi } from "./detect/robots";

export const CORE_VERSION = "0.1.0";

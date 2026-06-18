import { notFound } from "next/navigation";
import { getStore } from "@scanner/core";
import type { ClientPayload } from "@scanner/core";
import { ReportView } from "../../../_report/ReportView";
import styles from "./v3report.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function V3Report({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const payload = (await getStore().getReportBySlug(slug)) as ClientPayload | null;
  if (!payload) notFound();
  return <ReportView payload={payload} styles={styles} />;
}

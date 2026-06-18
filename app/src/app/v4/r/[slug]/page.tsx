import { notFound } from "next/navigation";
import { getStore } from "@scanner/core";
import type { ClientPayload } from "@scanner/core";
import { ReportView } from "../../../_report/ReportView";
import { V4ReportBg } from "./V4ReportBg";
import styles from "./v4report.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function V4Report({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const payload = (await getStore().getReportBySlug(slug)) as ClientPayload | null;
  if (!payload) notFound();
  return (
    <div style={{ background: "#05070d", minHeight: "100dvh" }}>
      <V4ReportBg />
      <ReportView payload={payload} styles={styles} />
    </div>
  );
}

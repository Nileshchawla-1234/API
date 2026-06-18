import { getStore, env } from "@scanner/core";
import { isAdmin } from "../_auth";

export const runtime = "nodejs";

/** CSV export of recent scans: name,domain,score,status,report_url */
export async function GET(req: Request) {
  if (!isAdmin(req)) return new Response("Unauthorized", { status: 401 });
  const scans = await getStore().listRecentScans(1000);
  const base = env.appBaseUrl;
  const rows = [
    "domain,score,status,report_url",
    ...scans.map((s) =>
      [s.domain, s.composite ?? "", s.status, s.slug ? `${base}/r/${s.slug}` : ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    ),
  ];
  return new Response(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="scans.csv"',
    },
  });
}

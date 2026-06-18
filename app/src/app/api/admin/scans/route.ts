import { NextResponse } from "next/server";
import { getStore } from "@scanner/core";
import { isAdmin } from "../_auth";

export const runtime = "nodejs";

/** Recent scans for the admin status board (JSON). */
export async function GET(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scans = await getStore().listRecentScans(200);
  return NextResponse.json({ scans });
}

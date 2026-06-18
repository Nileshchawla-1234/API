import { NextResponse } from "next/server";
import { env, getStore } from "@scanner/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Diagnostic: shows which backend the deployed app is using (no secrets). */
export async function GET() {
  let storeKind = "unknown";
  let storeError: string | null = null;
  try {
    storeKind = getStore().kind;
  } catch (e) {
    storeError = (e as Error).message;
  }
  return NextResponse.json({
    ok: true,
    backend: env.backend, // "memory" or "supabase"
    supabaseUrlSet: Boolean(env.supabaseUrl),
    supabaseKeySet: Boolean(env.supabaseServiceKey),
    storeKind,
    storeError,
  });
}

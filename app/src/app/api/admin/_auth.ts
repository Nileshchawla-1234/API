import { env } from "@scanner/core";

/** Returns true if the request carries the correct admin token. */
export function isAdmin(req: Request): boolean {
  const token = env.adminToken;
  if (!token) return false; // admin disabled until ADMIN_TOKEN is set
  const header = req.headers.get("x-admin-token");
  const url = new URL(req.url);
  const query = url.searchParams.get("token");
  return header === token || query === token;
}

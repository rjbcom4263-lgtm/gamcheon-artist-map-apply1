import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../admin/admin-auth";

export const runtime = "edge";

export async function GET(request: Request) {
  if (!await requireAdmin()) return new Response("Forbidden", { status: 403 });
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!key.startsWith("applications/") || key.includes("..")) return new Response("Bad request", { status: 400 });
  const object = await env.BUCKET.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("cache-control", "private, max-age=300");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}

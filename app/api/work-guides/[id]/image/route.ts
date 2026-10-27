import { env } from "cloudflare:workers";
import { requireSession } from "../../../../admin/admin-auth";
import { getGuide } from "../../../../work-guides/db";

export const runtime = "edge";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guide = await getGuide(id);
  if (!guide) return new Response("Not found", { status: 404 });
  const pending = new URL(request.url).searchParams.get("variant") === "pending";
  let key = guide.published_image_key;
  if (pending) {
    const viewer = await requireSession();
    if (!viewer || (viewer.role !== "admin" && viewer.accountId !== guide.account_id)) return new Response("Forbidden", { status: 403 });
    key = guide.pending_image_key || guide.published_image_key;
  }
  if (!key || !key.startsWith(`work-guides/${id}/`)) return new Response("Not found", { status: 404 });
  const object = await env.BUCKET.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}

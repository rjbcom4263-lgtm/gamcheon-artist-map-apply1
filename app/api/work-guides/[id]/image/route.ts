import { env } from "cloudflare:workers";
import { requireSession } from "../../../../admin/admin-auth";
import { getGuide } from "../../../../work-guides/db";
import { findPublicGuide } from "../../../../work-guides/public-guide";

import { protectedImage } from "../../../../work-guides/protected-image";

export const runtime = "edge";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pending = new URL(request.url).searchParams.get("variant") === "pending";
  // 검수용 사진은 아래에서 작가 본인·운영자만 통과시키고, 공개 사진은 공개 조건을 만족할 때만 내보냅니다.
  const guide = pending ? await getGuide(id) : await findPublicGuide(env.DB, id);
  if (!guide) return new Response("Not found", { status: 404 });
  let key = guide.published_image_key;
  if (pending) {
    const viewer = await requireSession();
    if (!viewer || (viewer.role !== "admin" && viewer.accountId !== guide.account_id)) return new Response("Forbidden", { status: 403 });
    key = guide.pending_image_key || guide.published_image_key;
  }
  if (!key || !key.startsWith(`work-guides/${id}/`)) return new Response("Not found", { status: 404 });
  if (!pending) return protectedImage(key, guide.artist_name);
  const object = await env.BUCKET.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}

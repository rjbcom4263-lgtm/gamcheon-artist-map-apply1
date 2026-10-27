import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../admin/admin-auth";
import { type GuideRow } from "../../../work-guides/db";
import { forbidden } from "../../../lib/http";

export const runtime = "edge";

export async function GET(request: Request) {
  if (!await requireAdmin()) return forbidden("운영자 로그인이 필요합니다.");
  if (new URL(request.url).searchParams.get("count") === "1") {
    const result = await env.DB.prepare("SELECT COUNT(*) AS count FROM artwork_guides WHERE pending_title IS NOT NULL").first<{ count: number }>();
    return Response.json({ count: result?.count || 0 }, { headers: { "cache-control": "no-store" } });
  }
  const rows = await env.DB.prepare("SELECT * FROM artwork_guides ORDER BY (pending_title IS NOT NULL) DESC, submitted_at DESC, created_at DESC LIMIT 500").all<GuideRow>();
  return Response.json({ guides: rows.results }, { headers: { "cache-control": "no-store" } });
}

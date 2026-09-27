import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../admin/admin-auth";

export const runtime = "edge";

function csv(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }

export async function GET() {
  if (!await requireAdmin()) return new Response("Forbidden", { status: 403 });
  const result = await env.DB.prepare("SELECT id, artist_name, phone, email, status, payload_json, created_at FROM artist_applications ORDER BY created_at DESC").all<Record<string, string>>();
  const lines = [["접수번호", "접수일", "상태", "처리사유", "처리일시", "작가명", "휴대전화", "이메일", "작품분야", "한줄소개", "공방명", "공방주소"]];
  for (const row of result.results || []) {
    let payload: { values?: Record<string, unknown>; categories?: string[]; adminReview?: { note?: string; processedAt?: string } } = {};
    try { payload = JSON.parse(row.payload_json); } catch {}
    const v = payload.values || {};
    lines.push([row.id, row.created_at, row.status, payload.adminReview?.note || "", payload.adminReview?.processedAt || "", row.artist_name, row.phone, row.email, payload.categories?.join(" / ") || "", String(v.tagline || ""), String(v.studioName || ""), String(v.address || v.studioAddress || "")]);
  }
  const body = "\uFEFF" + lines.map((line) => line.map(csv).join(",")).join("\r\n");
  return new Response(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="gamcheon-artist-applications-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" } });
}

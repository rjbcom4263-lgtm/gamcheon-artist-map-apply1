import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../admin/admin-auth";

export const runtime = "edge";
const allowedStatuses = new Set(["received", "reviewing", "approved", "hold", "rejected", "cancelled"]);
type ImageRecord = { key?: string };

async function authorized() {
  return !!await requireAdmin();
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await authorized()) return Response.json({ error: "권한이 없습니다." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json() as { status?: string; reviewNote?: string };
  if (!body.status || !allowedStatuses.has(body.status)) return Response.json({ error: "올바르지 않은 상태입니다." }, { status: 400 });
  const note = typeof body.reviewNote === "string" ? body.reviewNote.trim().slice(0, 2000) : "";
  if ((body.status === "rejected" || body.status === "cancelled") && !note) return Response.json({ error: "처리 사유를 입력해주세요." }, { status: 400 });
  const current = await env.DB.prepare("SELECT status, payload_json FROM artist_applications WHERE id = ?").bind(id).first<{ status: string; payload_json: string }>();
  if (!current) return Response.json({ error: "신청서를 찾을 수 없습니다." }, { status: 404 });
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(current.payload_json); } catch {}
  if (body.status === "approved" && current.status !== "approved") {
    const values = typeof payload.values === "object" && payload.values ? { ...payload.values as Record<string, unknown> } : {};
    if (values.mapPublished === undefined) values.mapPublished = false;
    payload.values = values;
  }
  payload.adminReview = { status: body.status, note, processedAt: new Date().toISOString() };
  const payloadJson = JSON.stringify(payload);
  const result = await env.DB.prepare("UPDATE artist_applications SET status = ?, payload_json = ? WHERE id = ?").bind(body.status, payloadJson, id).run();
  if (!result.meta.changes) return Response.json({ error: "신청서를 찾을 수 없습니다." }, { status: 404 });
  return Response.json({ ok: true, status: body.status, payload_json: payloadJson });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await authorized()) return Response.json({ error: "권한이 없습니다." }, { status: 403 });
  const { id } = await context.params;
  const current = await env.DB.prepare("SELECT image_keys_json FROM artist_applications WHERE id = ?").bind(id).first<{ image_keys_json: string }>();
  if (!current) return Response.json({ error: "신청서를 찾을 수 없습니다." }, { status: 404 });

  let images: ImageRecord[] = [];
  try { images = JSON.parse(current.image_keys_json); } catch {}
  const imageKeys = images
    .map((image) => image.key || "")
    .filter((key) => key.startsWith(`applications/${id}/`) && !key.includes(".."));

  const result = await env.DB.prepare("DELETE FROM artist_applications WHERE id = ?").bind(id).run();
  if (!result.meta.changes) return Response.json({ error: "신청서를 찾을 수 없습니다." }, { status: 404 });
  await Promise.allSettled(imageKeys.map((key) => env.BUCKET.delete(key)));
  return Response.json({ ok: true, deletedImages: imageKeys.length });
}

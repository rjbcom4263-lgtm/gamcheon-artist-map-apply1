import type { ApiContext } from "../../../../lib/api-context";
import { listImageKeys } from "../../../../lib/application.ts";
import { forbidden } from "../../../../lib/http.ts";
import { protectedImageKey } from "../../../../work-guides/protected-image-key.ts";

const allowedStatuses = new Set(["received", "reviewing", "approved", "hold", "rejected", "cancelled"]);
type ImageRecord = { key?: string };
type Guide = { id: string; artist_name: string; published_image_key: string | null; pending_image_key: string | null };

async function isAdmin(context: ApiContext) {
  return (await context.session())?.role === "admin";
}

export async function updateApplicationStatus(request: Request, id: string, context: ApiContext) {
  if (!await isAdmin(context)) return forbidden();
  const body = await request.json() as { status?: string; reviewNote?: string };
  if (!body.status || !allowedStatuses.has(body.status)) return Response.json({ error: "올바르지 않은 상태입니다." }, { status: 400 });
  const note = typeof body.reviewNote === "string" ? body.reviewNote.trim().slice(0, 2000) : "";
  if ((body.status === "rejected" || body.status === "cancelled") && !note) return Response.json({ error: "처리 사유를 입력해주세요." }, { status: 400 });
  const current = await context.DB.prepare("SELECT status, payload_json FROM artist_applications WHERE id = ?").bind(id).first<{ status: string; payload_json: string }>();
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
  const result = await context.DB.prepare("UPDATE artist_applications SET status = ?, payload_json = ? WHERE id = ?").bind(body.status, payloadJson, id).run();
  if (!result.meta.changes) return Response.json({ error: "신청서를 찾을 수 없습니다." }, { status: 404 });
  return Response.json({ ok: true, status: body.status, payload_json: payloadJson });
}

export async function deleteApplication(id: string, context: ApiContext) {
  if (!await isAdmin(context)) return forbidden();
  const current = await context.DB.prepare("SELECT artist_name, image_keys_json FROM artist_applications WHERE id = ?").bind(id).first<{ artist_name: string; image_keys_json: string }>();
  if (!current) return Response.json({ error: "신청서를 찾을 수 없습니다." }, { status: 404 });
  const { results: guides } = await context.DB.prepare("SELECT id, artist_name, published_image_key, pending_image_key FROM artwork_guides WHERE application_id = ?").bind(id).all<Guide>();

  let images: ImageRecord[] = [];
  try { images = JSON.parse(current.image_keys_json); } catch {}

  // 작가가 없어진 방문 통계와, 삭제 뒤에도 QR 주소로 공개되는 작품 해설이 남지 않게 함께 지웁니다.
  const [result] = await context.DB.batch([
    context.DB.prepare("DELETE FROM artist_applications WHERE id = ?").bind(id),
    context.DB.prepare("DELETE FROM artist_daily_stats WHERE application_id = ?").bind(id),
    context.DB.prepare("DELETE FROM artwork_guides WHERE application_id = ?").bind(id),
  ]);
  if (!result.meta.changes) return Response.json({ error: "신청서를 찾을 수 없습니다." }, { status: 404 });

  const applicationKeys = await storedKeys(context, `applications/${id}/`, images.map((image) => image.key));
  const guideKeys = await Promise.all(guides.map(async (guide) => ({
    guide,
    keys: await storedKeys(context, `work-guides/${guide.id}/`, [guide.published_image_key, guide.pending_image_key]),
  })));

  const originals = [...applicationKeys, ...guideKeys.flatMap(({ keys }) => keys)];
  const copies = await Promise.all([
    ...applicationKeys.map((key) => protectedImageKey(key, current.artist_name)),
    ...guideKeys.flatMap(({ guide, keys }) => keys.map((key) => protectedImageKey(key, guide.artist_name))),
  ]);
  await Promise.allSettled([...originals, ...copies].map((key) => context.BUCKET.delete(key)));
  return Response.json({ ok: true, deletedImages: originals.length, deletedGuides: guides.length });
}

// 기록된 키뿐 아니라 접두어 아래 남은 객체(작성 중 다시 고른 사진, 교체 전 사진 등)까지 모읍니다. 접두어 밖의 키는 지우지 않습니다.
async function storedKeys(context: ApiContext, prefix: string, recorded: Array<string | null | undefined>) {
  const keys = new Set(recorded.filter((key): key is string => !!key && key.startsWith(prefix) && !key.includes("..")));
  try { for (const key of await listImageKeys(context.BUCKET, prefix)) keys.add(key); } catch (error) { console.error("listing images failed", prefix, error); }
  return [...keys];
}

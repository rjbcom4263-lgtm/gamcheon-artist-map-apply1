import { env } from "cloudflare:workers";
import { requireArtist } from "../../../admin/admin-auth";
import { isAllowedImageFile } from "../../../image-upload";
import { getGuide, type GuideRow } from "../../../work-guides/db";

export const runtime = "edge";

const bad = (message: string, status = 400) => Response.json({ error: message }, { status });
const validId = (id: string) => /^WG-[0-9a-f-]{36}$/.test(id);

export async function GET() {
  const artist = await requireArtist();
  if (!artist) return bad("로그인이 필요합니다.", 403);
  const rows = await env.DB.prepare("SELECT * FROM artwork_guides WHERE account_id = ? ORDER BY created_at DESC")
    .bind(artist.accountId).all<GuideRow>();
  return Response.json({ guides: rows.results }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const artist = await requireArtist();
  if (!artist) return bad("로그인이 필요합니다.", 403);
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return bad("요청 출처를 확인해 주세요.", 403);
  let form: FormData;
  try { form = await request.formData(); } catch { return bad("요청 형식이 올바르지 않습니다."); }
  const rawTitle = form.get("title");
  const rawDescription = form.get("description");
  const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
  const description = typeof rawDescription === "string" ? rawDescription.trim() : "";
  const existingId = String(form.get("id") || "");
  const sourceIndexRaw = form.get("sourceIndex");
  const sourceIndex = sourceIndexRaw === null ? null : Number(sourceIndexRaw);
  const file = form.get("image");
  if (!title || title.length > 150 || !description || description.length > 3000) return bad("작품명과 한국어 해설을 입력해 주세요. 해설은 3000자 이내로 작성해 주세요.");
  if (existingId && !validId(existingId)) return bad("작품 주소가 올바르지 않습니다.");
  if (sourceIndex !== null && (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex > 100)) return bad("가져올 대표 작품을 확인해 주세요.");
  const image = file instanceof File && file.size ? file : null;
  if (image && (image.size > 2 * 1024 * 1024 || !await isAllowedImageFile(image))) return bad("JPG, PNG, WebP 이미지만 2MB 이하로 올려주세요.");

  const application = await env.DB.prepare("SELECT id, artist_name, image_keys_json FROM artist_applications WHERE account_id = ? AND status = 'approved' ORDER BY created_at DESC LIMIT 1")
    .bind(artist.accountId).first<{ id: string; artist_name: string; image_keys_json: string }>();
  if (!application) return bad("승인된 작가 정보가 필요합니다.", 403);
  const previous = existingId ? await getGuide(existingId) : null;
  if (existingId && (!previous || previous.account_id !== artist.accountId)) return bad("수정할 작품을 찾을 수 없습니다.", 404);
  let sourceKey = "";
  if (sourceIndex !== null) {
    try {
      const images = JSON.parse(application.image_keys_json) as { type?: string; workIndex?: number; key?: string }[];
      sourceKey = images.find((item) => item.type === "work" && item.workIndex === sourceIndex)?.key || "";
    } catch { /* The artist can upload a new image instead. */ }
    if (!sourceKey.startsWith(`applications/${application.id}/`)) return bad("대표 작품 사진을 찾을 수 없습니다.");
  }
  if (!image && !sourceKey && !previous?.pending_image_key && !previous?.published_image_key) return bad("작품 사진을 선택해 주세요.");

  const id = existingId || `WG-${crypto.randomUUID()}`;
  const sourceExtension = sourceKey.split(".").pop()?.toLowerCase();
  const extension = image ? image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg" : sourceExtension === "png" || sourceExtension === "webp" ? sourceExtension : "jpg";
  const uploadedKey = image || sourceKey ? `work-guides/${id}/${crypto.randomUUID()}.${extension}` : "";
  const pendingImageKey = uploadedKey || previous?.pending_image_key || previous?.published_image_key || "";
  const submittedAt = new Date().toISOString();
  try {
    if (image) await env.BUCKET.put(uploadedKey, image.stream(), { httpMetadata: { contentType: image.type }, customMetadata: { guideId: id, accountId: artist.accountId } });
    else if (sourceKey) {
      const source = await env.BUCKET.get(sourceKey);
      if (!source) return bad("대표 작품 사진을 찾을 수 없습니다.");
      await env.BUCKET.put(uploadedKey, source.body, { httpMetadata: source.httpMetadata, customMetadata: { guideId: id, accountId: artist.accountId } });
    }
    if (previous) {
      const updated = await env.DB.prepare(`UPDATE artwork_guides SET artist_name = ?, pending_title = ?, pending_description = ?, pending_image_key = ?, submitted_at = ?, pending_revision = pending_revision + 1
        WHERE id = ? AND account_id = ? AND pending_revision = ?`).bind(application.artist_name, title, description, pendingImageKey, submittedAt, id, artist.accountId, previous.pending_revision).run();
      if (!updated.meta.changes) throw new Error("artwork guide changed during submission");
    } else {
      await env.DB.prepare(`INSERT INTO artwork_guides (id, account_id, application_id, artist_name, pending_title, pending_description, pending_image_key, submitted_at, pending_revision)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`).bind(id, artist.accountId, application.id, application.artist_name, title, description, pendingImageKey, submittedAt).run();
    }
  } catch (error) {
    if (uploadedKey) await env.BUCKET.delete(uploadedKey).catch(() => {});
    console.error("artwork guide submission failed", error);
    return bad("작품 해설을 저장하지 못했습니다. 다시 시도해 주세요.", 500);
  }
  if (previous?.pending_image_key && previous.pending_image_key !== previous.published_image_key && previous.pending_image_key !== pendingImageKey) {
    await env.BUCKET.delete(previous.pending_image_key).catch((error: unknown) => console.error("old pending artwork image cleanup failed", error));
  }
  return Response.json({ ok: true, id });
}

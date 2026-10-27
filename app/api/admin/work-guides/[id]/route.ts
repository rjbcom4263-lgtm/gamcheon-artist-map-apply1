import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../admin/admin-auth";
import { getGuide } from "../../../../work-guides/db";
import { GUIDE_LANGUAGES, type Translation } from "../../../../work-guides/shared";

export const runtime = "edge";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return Response.json({ error: "운영자 로그인이 필요합니다." }, { status: 403 });
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "요청 출처를 확인해 주세요." }, { status: 403 });
  const { id } = await params;
  let input: Record<string, unknown>;
  try { input = await request.json() as Record<string, unknown>; } catch { return Response.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 }); }
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const revision = input.revision;
  if (!title || title.length > 150 || !description || description.length > 3000 || typeof revision !== "number" || !Number.isInteger(revision)) return Response.json({ error: "작품명과 한국어 해설을 확인해 주세요." }, { status: 400 });
  const rawTranslations = input.translations && typeof input.translations === "object" && !Array.isArray(input.translations) ? input.translations as Record<string, unknown> : {};
  const translations: Record<string, Translation> = {};
  for (const { code } of GUIDE_LANGUAGES) {
    const raw = rawTranslations[code];
    if (!raw) continue;
    if (typeof raw !== "object") return Response.json({ error: "번역 형식을 확인해 주세요." }, { status: 400 });
    const translated = raw as Record<string, unknown>;
    const translatedTitle = typeof translated.title === "string" ? translated.title.trim() : "";
    const translatedDescription = typeof translated.description === "string" ? translated.description.trim() : "";
    if (!translatedTitle && !translatedDescription) continue;
    if (!translatedTitle || translatedTitle.length > 150 || !translatedDescription || translatedDescription.length > 3000) return Response.json({ error: "번역 제목과 해설을 함께 입력해 주세요." }, { status: 400 });
    translations[code] = { title: translatedTitle, description: translatedDescription };
  }
  const guide = await getGuide(id);
  if (!guide || (!guide.pending_title && !guide.published_title)) return Response.json({ error: "검수할 작품을 찾을 수 없습니다." }, { status: 404 });
  const nextImageKey = guide.pending_image_key || guide.published_image_key;
  if (!nextImageKey) return Response.json({ error: "작품 사진이 없습니다." }, { status: 400 });
  const publishedAt = new Date().toISOString();
  const result = await env.DB.prepare(`UPDATE artwork_guides SET published_title = ?, published_description = ?, published_image_key = ?, translations_json = ?, published_at = ?,
    pending_title = NULL, pending_description = NULL, pending_image_key = NULL, submitted_at = NULL WHERE id = ? AND pending_revision = ?`)
    .bind(title, description, nextImageKey, JSON.stringify(translations), publishedAt, id, revision).run();
  if (!result.meta.changes) return Response.json({ error: "작가가 새 내용을 제출했습니다. 목록을 새로고침해 다시 검수해 주세요." }, { status: 409 });
  if (guide.published_image_key && guide.published_image_key !== nextImageKey) await env.BUCKET.delete(guide.published_image_key).catch((error: unknown) => console.error("old artwork image cleanup failed", error));
  return Response.json({ ok: true, id });
}

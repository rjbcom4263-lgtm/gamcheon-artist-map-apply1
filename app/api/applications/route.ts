import { env } from "cloudflare:workers";
import { requireArtist } from "../../admin/admin-auth";
import { sanitizeExperiences } from "../../artist/profile-data";
import { isAllowedImageFile, isAllowedImageType } from "../../image-upload";
import { MAX_IMAGE_BYTES, REQUIRED_WORK_COUNT, applicationId, cleanText, safeFileName } from "../../lib/application";
import { forbidden } from "../../lib/http";

export const runtime = "edge";

type Payload = {
  applicationId?: string;
  values?: Record<string, string | boolean>;
  categories?: string[];
  works?: Array<{ id?: string; title?: string; status?: string; description?: string }>;
  experiences?: unknown[];
  expectedImages?: { profile?: boolean; works?: boolean[] };
  uploadedImages?: Array<{ type?: string; workIndex?: number; key?: string; name?: string; contentType?: string }>;
};

export async function POST(request: Request) {
  const uploaded: string[] = [];
  try {
    const user = await requireArtist();
    if (!user) return forbidden("회원가입 또는 로그인 후 신청해주세요.");
    const form = await request.formData();
    const raw = form.get("payload");
    if (typeof raw !== "string" || raw.length > 150_000) return Response.json({ error: "신청서 내용이 너무 큽니다." }, { status: 400 });
    const payload = JSON.parse(raw) as Payload;
    const values = payload.values || {};
    const artistName = cleanText(values.artistName, 100);
    const phone = cleanText(values.phone, 30);
    const email = cleanText(values.email, 150);
    const categories = Array.isArray(payload.categories) ? payload.categories.slice(0, 12).map((x) => cleanText(x, 30)).filter(Boolean) : [];
    const works = Array.isArray(payload.works) ? payload.works.slice(0, REQUIRED_WORK_COUNT).map((w) => ({ id: cleanText(w.id, 80), title: cleanText(w.title, 150), status: cleanText(w.status, 40), description: cleanText(w.description, 1200) })) : [];
    const experiences = sanitizeExperiences(payload.experiences);
    if (!artistName || !phone || !categories.length || works.length !== REQUIRED_WORK_COUNT || works.some((work) => !work.title)) return Response.json({ error: "대표 작품 5점의 필수 정보를 모두 입력해주세요." }, { status: 400 });
    if (payload.experiences !== undefined && (!Array.isArray(payload.experiences) || payload.experiences.length > 20 || experiences.some((experience) => !experience.title))) return Response.json({ error: "체험 프로그램 이름을 확인해주세요." }, { status: 400 });
    if (!values.consentInfo || !values.consentImage || !values.consentPrivacy) return Response.json({ error: "필수 동의가 필요합니다." }, { status: 400 });

    const id = applicationId(payload.applicationId);
    if (!id) return Response.json({ error: "신청 번호를 다시 확인해주세요." }, { status: 400 });
    const draft = await env.DB.prepare("SELECT id FROM artist_applications WHERE id = ? AND account_id = ? AND status = 'draft'")
      .bind(id, user.accountId).first<{ id: string }>();
    if (!draft) return forbidden("이 계정의 신청서가 아니거나 이미 제출된 신청서입니다.");
    const imageRecords: Array<{ type: string; workIndex?: number; key: string; name: string; contentType: string }> = [];
    const imageSlots = new Set<string>();
    if (Array.isArray(payload.uploadedImages)) {
      for (const image of payload.uploadedImages) {
        const type = image.type === "profile" || image.type === "work" ? image.type : "";
        const workIndex = Number.isInteger(image.workIndex) ? image.workIndex : undefined;
        const key = cleanText(image.key, 260);
        const contentType = cleanText(image.contentType, 80);
        if (!type || !key.startsWith(`applications/${id}/`) || !contentType.startsWith("image/")) continue;
        if (type === "work" && (typeof workIndex !== "number" || workIndex < 0 || workIndex >= REQUIRED_WORK_COUNT)) continue;
        const slot = type === "profile" ? "profile" : `work:${workIndex}`;
        if (imageSlots.has(slot)) return Response.json({ error: "같은 위치의 이미지가 중복되었습니다." }, { status: 400 });
        const stored = await env.BUCKET.head(key);
        const storedType = stored?.httpMetadata?.contentType || "";
        if (!stored || stored.customMetadata?.applicationId !== id || !isAllowedImageType(storedType)) return Response.json({ error: "저장된 이미지 정보를 확인하지 못했습니다. 다시 올려주세요." }, { status: 400 });
        imageSlots.add(slot);
        imageRecords.push({ type, workIndex, key, name: cleanText(image.name, 180), contentType: storedType });
      }
    }
    const candidates: Array<{ key: string; type: string; workIndex?: number }> = [{ key: "profileImage", type: "profile" }, ...works.map((_, i) => ({ key: `workImage${i}`, type: "work", workIndex: i }))];
    for (const candidate of candidates) {
      const item = form.get(candidate.key);
      if (!item || typeof item === "string" || typeof item.size !== "number" || !item.size) continue;
      if (item.size > MAX_IMAGE_BYTES || !(await isAllowedImageFile(item))) return Response.json({ error: "JPG, PNG, WebP 이미지만 장당 2MB 이하로 올려주세요." }, { status: 400 });
      const slot = candidate.type === "profile" ? "profile" : `work:${candidate.workIndex}`;
      if (imageSlots.has(slot)) return Response.json({ error: "같은 위치의 이미지가 중복되었습니다." }, { status: 400 });
      const key = `applications/${id}/${safeFileName(item)}`;
      await env.BUCKET.put(key, item.stream(), { httpMetadata: { contentType: item.type }, customMetadata: { applicationId: id, originalName: item.name.slice(0, 180) } });
      uploaded.push(key);
      imageSlots.add(slot);
      imageRecords.push({ type: candidate.type, workIndex: candidate.workIndex, key, name: item.name.slice(0, 180), contentType: item.type });
    }

    const expectedCount = (payload.expectedImages?.profile ? 1 : 0) + (payload.expectedImages?.works || []).filter(Boolean).length;
    if (expectedCount !== imageRecords.length) {
      await Promise.allSettled(uploaded.map((key) => env.BUCKET.delete(key)));
      uploaded.length = 0;
      return Response.json({ error: "선택한 사진이 모두 저장되지 않았습니다. 사진을 다시 선택해주세요." }, { status: 400 });
    }
    const workImageCount = imageRecords.filter((image) => image.type === "work").length;
    if (workImageCount !== REQUIRED_WORK_COUNT) {
      await Promise.allSettled(uploaded.map((key) => env.BUCKET.delete(key)));
      uploaded.length = 0;
      return Response.json({ error: "대표 작품 5점의 이미지를 모두 올려주세요." }, { status: 400 });
    }

    const safePayload = { values: { ...values, artistName, phone, email }, categories, works, experiences };
    const saved = await env.DB.prepare("UPDATE artist_applications SET artist_name = ?, phone = ?, email = ?, status = 'received', payload_json = ?, image_keys_json = ? WHERE id = ? AND account_id = ? AND status = 'draft'")
      .bind(artistName, phone, email, JSON.stringify(safePayload), JSON.stringify(imageRecords), id, user.accountId).run();
    if (!saved.meta.changes) {
      await Promise.allSettled(uploaded.map((key) => env.BUCKET.delete(key)));
      uploaded.length = 0;
      return Response.json({ error: "이미 제출된 신청서입니다." }, { status: 409 });
    }
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    await Promise.allSettled(uploaded.map((key) => env.BUCKET.delete(key)));
    console.error("application submission failed", error);
    return Response.json({ error: "접수가 완료되지 않았습니다. 잠시 뒤 다시 시도해주세요." }, { status: 500 });
  }
}

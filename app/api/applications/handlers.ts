import { sanitizeApplicationValues } from "../../apply/application-values.ts";
import { experiencesInvalid, sanitizeCategories, sanitizeExperiences, sanitizeWorks } from "../../artist/profile-data.ts";
import { isAllowedImageFile, isAllowedImageType } from "../../image-upload.ts";
import type { ApiContext } from "../../lib/api-context";
import { MAX_IMAGE_BYTES, MAX_IMAGE_LABEL, REQUIRED_WORK_COUNT, applicationId, cleanText, listApplicationImageKeys, safeFileName } from "../../lib/application.ts";
import { badRequest, forbidden, jsonError } from "../../lib/http.ts";
import { parse } from "../../lib/json.ts";
import { APPLY_CONSENT_VERSION } from "../../signup/privacy-consent.ts";

type Payload = {
  applicationId?: string;
  values?: unknown;
  categories?: unknown;
  works?: unknown;
  experiences?: unknown;
  expectedImages?: { profile?: boolean; works?: boolean[] };
  uploadedImages?: Array<{ type?: string; workIndex?: number; key?: string; name?: string; contentType?: string } | null>;
};
type ImageRecord = { type: string; workIndex?: number; key: string; name: string; contentType: string };

function readPayload(raw: string): Payload | null {
  const value = parse<unknown>(raw, null);
  return value && typeof value === "object" ? value as Payload : null;
}
const slotOf = (type: string, workIndex?: number) => type === "profile" ? "profile" : `work:${workIndex}`;

export async function submitApplication(request: Request, context: ApiContext) {
  const uploaded: string[] = [];
  const discardUploads = () => Promise.allSettled(uploaded.map((key) => context.BUCKET.delete(key)));
  const rejectAfterUpload = async (error: string, status = 400) => {
    await discardUploads();
    return jsonError(error, status);
  };
  try {
    const user = await context.session();
    if (user?.role !== "artist") return forbidden("회원가입 또는 로그인 후 신청해주세요.");
    const form = await request.formData();
    const raw = form.get("payload");
    if (typeof raw !== "string" || raw.length > 150_000) return badRequest("신청서 내용이 너무 큽니다.");
    const payload = readPayload(raw);
    if (!payload) return badRequest("신청서 내용을 읽지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.");
    const values = sanitizeApplicationValues(payload.values);
    const { artistName, phone, email } = values;
    const categories = sanitizeCategories(payload.categories);
    const works = sanitizeWorks(payload.works);
    const experiences = sanitizeExperiences(payload.experiences);
    if (!artistName || !phone || !categories.length || works.length !== REQUIRED_WORK_COUNT || works.some((work) => !work.title)) return badRequest(`대표 작품 ${REQUIRED_WORK_COUNT}점의 필수 정보를 모두 입력해주세요.`);
    if (experiencesInvalid(payload.experiences, experiences)) return badRequest("체험 프로그램 이름을 확인해주세요.");
    if (!values.consentInfo || !values.consentImage || !values.consentPrivacy) return badRequest("필수 동의가 필요합니다.");
    // 동의 문구가 바뀐 뒤 옛 화면에서 보낸 신청은 받지 않습니다. 어떤 문구에 동의했는지는 values.consentVersion으로 남습니다.
    if (values.consentVersion !== APPLY_CONSENT_VERSION) return badRequest("동의 안내가 바뀌었습니다. 페이지를 새로고침한 뒤 동의 항목을 다시 확인해 주세요.");

    const id = applicationId(payload.applicationId);
    if (!id) return badRequest("신청 번호를 다시 확인해주세요.");
    const draft = await context.DB.prepare("SELECT id FROM artist_applications WHERE id = ? AND account_id = ? AND status = 'draft'")
      .bind(id, user.accountId).first<{ id: string }>();
    if (!draft) return forbidden("이 계정의 신청서가 아니거나 이미 제출된 신청서입니다.");

    // 자리(프로필, 작품 번호)마다 이미지 하나입니다.
    const images = new Map<string, ImageRecord>();
    for (const image of Array.isArray(payload.uploadedImages) ? payload.uploadedImages : []) {
      if (!image) continue;
      const type = image.type === "profile" || image.type === "work" ? image.type : "";
      const workIndex = Number.isInteger(image.workIndex) ? image.workIndex : undefined;
      const key = cleanText(image.key, 260);
      const contentType = cleanText(image.contentType, 80);
      if (!type || !key.startsWith(`applications/${id}/`) || !contentType.startsWith("image/")) continue;
      if (type === "work" && (typeof workIndex !== "number" || workIndex < 0 || workIndex >= REQUIRED_WORK_COUNT)) continue;
      const slot = slotOf(type, workIndex);
      if (images.has(slot)) return badRequest("같은 위치의 이미지가 중복되었습니다.");
      const stored = await context.BUCKET.head(key);
      const storedType = stored?.httpMetadata?.contentType || "";
      if (!stored || stored.customMetadata?.applicationId !== id || !isAllowedImageType(storedType)) return badRequest("저장된 이미지 정보를 확인하지 못했습니다. 다시 올려주세요.");
      images.set(slot, { type, workIndex, key, name: cleanText(image.name, 180), contentType: storedType });
    }
    const candidates: Array<{ key: string; type: string; workIndex?: number }> = [{ key: "profileImage", type: "profile" }, ...works.map((_, i) => ({ key: `workImage${i}`, type: "work", workIndex: i }))];
    for (const candidate of candidates) {
      const item = form.get(candidate.key);
      if (!item || typeof item === "string" || !item.size) continue;
      if (item.size > MAX_IMAGE_BYTES || !(await isAllowedImageFile(item))) return rejectAfterUpload(`JPG, PNG, WebP 이미지만 장당 ${MAX_IMAGE_LABEL} 이하로 올려주세요.`);
      const slot = slotOf(candidate.type, candidate.workIndex);
      if (images.has(slot)) return rejectAfterUpload("같은 위치의 이미지가 중복되었습니다.");
      const key = `applications/${id}/${safeFileName(item)}`;
      await context.BUCKET.put(key, item.stream(), { httpMetadata: { contentType: item.type }, customMetadata: { applicationId: id, originalName: item.name.slice(0, 180) } });
      uploaded.push(key);
      images.set(slot, { type: candidate.type, workIndex: candidate.workIndex, key, name: item.name.slice(0, 180), contentType: item.type });
    }

    const imageRecords = [...images.values()];
    const expectedWorks = Array.isArray(payload.expectedImages?.works) ? payload.expectedImages.works : [];
    const expectedCount = (payload.expectedImages?.profile ? 1 : 0) + expectedWorks.filter(Boolean).length;
    if (expectedCount !== imageRecords.length) return rejectAfterUpload("선택한 사진이 모두 저장되지 않았습니다. 사진을 다시 선택해주세요.");
    if (imageRecords.filter((image) => image.type === "work").length !== REQUIRED_WORK_COUNT) return rejectAfterUpload(`대표 작품 ${REQUIRED_WORK_COUNT}점의 이미지를 모두 올려주세요.`);

    const safePayload = { values, categories, works, experiences };
    const saved = await context.DB.prepare("UPDATE artist_applications SET artist_name = ?, phone = ?, email = ?, status = 'received', payload_json = ?, image_keys_json = ? WHERE id = ? AND account_id = ? AND status = 'draft'")
      .bind(artistName, phone, email, JSON.stringify(safePayload), JSON.stringify(imageRecords), id, user.accountId).run();
    if (!saved.meta.changes) return rejectAfterUpload("이미 제출된 신청서입니다.", 409);
    // 작성 중 여러 번 다시 고른 사진처럼 신청서에 기록되지 않은 객체는 여기서 지웁니다(실패해도 접수는 유지).
    try {
      const referenced = new Set(imageRecords.map((image) => image.key));
      const orphans = (await listApplicationImageKeys(context.BUCKET, id)).filter((key) => !referenced.has(key));
      if (orphans.length) await context.BUCKET.delete(orphans);
    } catch (error) {
      console.error("orphan image cleanup failed", id, error);
    }
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    await discardUploads();
    console.error("application submission failed", error);
    return jsonError("접수가 완료되지 않았습니다. 잠시 뒤 다시 시도해주세요.", 500);
  }
}

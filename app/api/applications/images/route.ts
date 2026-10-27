import { env } from "cloudflare:workers";
import { requireArtist } from "../../../admin/admin-auth";
import { isAllowedImageFile } from "../../../image-upload";
import { MAX_IMAGE_BYTES, applicationId as validApplicationId, cleanText, safeFileName } from "../../../lib/application";
import { forbidden } from "../../../lib/http";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const user = await requireArtist();
    if (!user) return forbidden("회원가입 또는 로그인 후 신청해주세요.");
    const form = await request.formData();
    const applicationId = cleanText(form.get("applicationId"), 40);
    const type = cleanText(form.get("type"), 20);
    const workIndex = Number(form.get("workIndex"));
    const image = form.get("image");
    if (!validApplicationId(applicationId)) return Response.json({ error: "신청 번호를 다시 확인해주세요." }, { status: 400 });
    if (type !== "profile" && type !== "work") return Response.json({ error: "이미지 구분을 다시 확인해주세요." }, { status: 400 });
    if (type === "work" && (!Number.isInteger(workIndex) || workIndex < 0 || workIndex > 4)) return Response.json({ error: "작품 이미지 번호를 다시 확인해주세요." }, { status: 400 });
    if (!image || typeof image === "string" || typeof image.size !== "number" || !image.size) return Response.json({ error: "이미지 파일을 선택해주세요." }, { status: 400 });
    if (image.size > MAX_IMAGE_BYTES || !(await isAllowedImageFile(image))) return Response.json({ error: "JPG, PNG, WebP 이미지만 장당 2MB 이하로 올려주세요." }, { status: 400 });

    const draft = await env.DB.prepare("SELECT id FROM artist_applications WHERE id = ? AND account_id = ? AND status = 'draft'")
      .bind(applicationId, user.accountId).first<{ id: string }>();
    if (!draft) return forbidden("이 계정의 신청서가 아니거나 이미 제출된 신청서입니다.");

    const key = `applications/${applicationId}/${safeFileName(image)}`;
    await env.BUCKET.put(key, image.stream(), { httpMetadata: { contentType: image.type }, customMetadata: { applicationId, originalName: image.name.slice(0, 180) } });
    return Response.json({
      image: {
        type,
        workIndex: type === "work" ? workIndex : undefined,
        key,
        name: image.name.slice(0, 180),
        contentType: image.type,
      },
    });
  } catch (error) {
    console.error("application image upload failed", error);
    return Response.json({ error: "이미지를 저장하지 못했습니다. 잠시 뒤 다시 시도해주세요." }, { status: 500 });
  }
}

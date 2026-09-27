import { env } from "cloudflare:workers";
import { requireArtist } from "../../../admin/admin-auth";
import { sanitizeArtistProfile, type ProfileInput } from "../../../artist/profile-data";
import { ensureApplicationsTable } from "../../../applications-db";
import { isAllowedImageFile } from "../../../image-upload";

export const runtime = "edge";

type Application = { payload_json: string; image_keys_json: string };
type ImageRecord = { type: string; workIndex?: number; key: string; name?: string; contentType?: string };

function safeFileName(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return `${crypto.randomUUID()}.${ext.slice(0, 8)}`;
}

export async function PUT(request: Request) {
  const artist = await requireArtist();
  if (!artist) return Response.json({ error: "로그인이 필요합니다." }, { status: 403 });

  const form = await request.formData();
  const applicationId = typeof form.get("applicationId") === "string" ? String(form.get("applicationId")) : "";
  const raw = form.get("profile");
  if (!/^GA-\d{8}-[A-F0-9]{6}$/.test(applicationId) || typeof raw !== "string" || raw.length > 100_000) return Response.json({ error: "수정 정보를 확인해주세요." }, { status: 400 });

  let input: ProfileInput;
  try { input = JSON.parse(raw) as ProfileInput; } catch { return Response.json({ error: "수정 정보를 확인해주세요." }, { status: 400 }); }
  const cleaned = sanitizeArtistProfile(input);
  if ("error" in cleaned) return Response.json(cleaned, { status: 400 });

  await ensureApplicationsTable();
  const current = await env.DB.prepare(`SELECT payload_json, image_keys_json FROM artist_applications
    WHERE id = ? AND status = 'approved' AND account_id = ?`)
    .bind(applicationId, artist.accountId).first<Application>();
  if (!current) return Response.json({ error: "수정 가능한 승인 프로필을 찾을 수 없습니다." }, { status: 404 });

  let payload: Record<string, unknown> = {};
  let images: ImageRecord[] = [];
  try { payload = JSON.parse(current.payload_json); } catch {}
  try { images = JSON.parse(current.image_keys_json); } catch {}
  const files = [{ name: "profileImage", type: "profile" }, ...cleaned.works.map((_, index) => ({ name: `workImage${index}`, type: "work", workIndex: index }))];
  const replacements: Array<{ file: File; type: string; workIndex?: number }> = [];
  for (const candidate of files) {
    const value = form.get(candidate.name);
    if (!value || typeof value === "string" || !value.size) continue;
    if (value.size > 2 * 1024 * 1024 || !(await isAllowedImageFile(value))) return Response.json({ error: "JPG, PNG, WebP 이미지만 장당 2MB 이하로 올려주세요." }, { status: 400 });
    replacements.push({ file: value, type: candidate.type, workIndex: candidate.workIndex });
  }

  const uploaded: string[] = [];
  const replaced: string[] = [];
  try {
    for (const replacement of replacements) {
      const key = `applications/${applicationId}/${safeFileName(replacement.file)}`;
      await env.BUCKET.put(key, replacement.file.stream(), { httpMetadata: { contentType: replacement.file.type }, customMetadata: { applicationId, originalName: replacement.file.name.slice(0, 180) } });
      uploaded.push(key);
      const old = images.find((image) => image.type === replacement.type && (replacement.type === "profile" || image.workIndex === replacement.workIndex));
      if (old) replaced.push(old.key);
      images = images.filter((image) => !(image.type === replacement.type && (replacement.type === "profile" || image.workIndex === replacement.workIndex)));
      images.push({ type: replacement.type, workIndex: replacement.workIndex, key, name: replacement.file.name.slice(0, 180), contentType: replacement.file.type });
    }

    const oldValues = typeof payload.values === "object" && payload.values ? payload.values as Record<string, unknown> : {};
    payload = { ...payload, values: { ...oldValues, ...cleaned.values, artistName: cleaned.artistName }, categories: cleaned.categories, works: cleaned.works };
    const update = await env.DB.prepare("UPDATE artist_applications SET artist_name = ?, payload_json = ?, image_keys_json = ? WHERE id = ? AND account_id = ? AND status = 'approved'")
      .bind(cleaned.artistName, JSON.stringify(payload), JSON.stringify(images), applicationId, artist.accountId).run();
    if (!update.meta.changes) throw new Error("approved application changed during update");
    await Promise.allSettled(replaced.map((key) => env.BUCKET.delete(key)));
    return Response.json({ ok: true });
  } catch (error) {
    await Promise.allSettled(uploaded.map((key) => env.BUCKET.delete(key)));
    console.error("artist profile update failed", error);
    return Response.json({ error: "프로필을 저장하지 못했습니다. 다시 시도해주세요." }, { status: 500 });
  }
}

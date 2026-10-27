import { env } from "cloudflare:workers";
import { applicationIdFromImageKey } from "../../../image-upload";

export const runtime = "edge";

type ImageRecord = { key?: string };
type ArtistImagesRow = { image_keys_json: string };

// 공개 작가 이미지. 키 형식이 applications/{신청서 id}/... 이므로 그 신청서 한 행만 조회해
// 승인된 신청서의 이미지 목록에 들어 있는 키인지 확인합니다.
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key") || "";
  const applicationId = applicationIdFromImageKey(key);
  if (!applicationId) return new Response("Bad request", { status: 400 });

  const row = await env.DB.prepare("SELECT image_keys_json FROM artist_applications WHERE id = ? AND status = 'approved'")
    .bind(applicationId).first<ArtistImagesRow>();
  if (!row || !imageKeysInclude(row.image_keys_json, key)) return new Response("Not found", { status: 404 });

  const object = await env.BUCKET.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("cache-control", "public, max-age=300");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}

function imageKeysInclude(imageKeysJson: string, key: string) {
  try { return (JSON.parse(imageKeysJson) as ImageRecord[]).some((image) => image.key === key); } catch { return false; }
}

import { env } from "cloudflare:workers";
import { requireArtist } from "../../../admin/admin-auth";
import { applicationIdFromImageKey } from "../../../image-upload";

export const runtime = "edge";

type ApplicationImageRow = { image_keys_json: string };
type ImageRecord = { key?: string };

// 로그인한 작가 본인의 신청서 이미지. 키에 든 신청서 id로 한 행만 조회하고, 그 신청서가 본인 계정 것인지 함께 확인합니다.
export async function GET(request: Request) {
  const artist = await requireArtist();
  if (!artist) return new Response("Forbidden", { status: 403 });
  const key = new URL(request.url).searchParams.get("key") || "";
  const applicationId = applicationIdFromImageKey(key);
  if (!applicationId) return new Response("Bad request", { status: 400 });

  const row = await env.DB.prepare("SELECT image_keys_json FROM artist_applications WHERE id = ? AND account_id = ?")
    .bind(applicationId, artist.accountId).first<ApplicationImageRow>();
  const allowed = (() => {
    if (!row) return false;
    try { return (JSON.parse(row.image_keys_json) as ImageRecord[]).some((image) => image.key === key); } catch { return false; }
  })();
  if (!allowed) return new Response("Forbidden", { status: 403 });

  const object = await env.BUCKET.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("cache-control", "private, max-age=300");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}

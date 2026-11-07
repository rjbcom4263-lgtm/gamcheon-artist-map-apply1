import type { ApiContext } from "../../../lib/api-context";
import { PUBLIC_ARTIST } from "../../../artists/public-artist-query.ts";
import { applicationIdFromImageKey, imageKeysInclude } from "../../../image-upload.ts";

type Row = { account_id: string; artist_name: string; image_keys_json: string; is_public: number };
type Render = (key: string, artistName: string) => Promise<Response>;

// 작가 이미지. 키 형식이 applications/{신청서 id}/... 이므로 그 신청서 한 행만 보고, 이미지 목록에 있는 키만 내보냅니다.
// 방문객은 공개 작가의 이미지만 받습니다. 숨겨진 동안에도 작가 본인과 운영자는 수정 화면에서 볼 수 있게 하되 캐시하지 않습니다.
export async function serveArtistImage(request: Request, context: ApiContext, render: Render) {
  const key = new URL(request.url).searchParams.get("key") || "";
  const applicationId = applicationIdFromImageKey(key);
  if (!applicationId) return new Response("Bad request", { status: 400 });

  const row = await context.DB.prepare(`SELECT a.account_id, a.artist_name, a.image_keys_json, (${PUBLIC_ARTIST}) AS is_public FROM artist_applications a WHERE a.id = ? AND a.status = 'approved'`)
    .bind(applicationId).first<Row>();
  if (!row || !imageKeysInclude(row.image_keys_json, key)) return new Response("Not found", { status: 404 });

  if (row.is_public) return render(key, row.artist_name);

  const viewer = await context.session();
  if (viewer?.role !== "admin" && viewer?.accountId !== row.account_id) return new Response("Not found", { status: 404 });
  const image = await render(key, row.artist_name);
  const headers = new Headers(image.headers);
  headers.set("cache-control", "private, no-store");
  return new Response(image.body, { status: image.status, headers });
}

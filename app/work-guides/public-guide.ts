import { PUBLIC_ARTIST } from "../artists/public-artist-query.ts";
import type { ApiContext } from "../lib/api-context";
import type { GuideRow } from "./db";

// 방문객에게 보여도 되는 작품 해설의 조건입니다. 내용을 공개했고 작가가 공개 상태인 동안만 보여 줍니다.
// 데이터를 지우지 않으므로 작가가 다시 공개되면 같은 QR이 다시 열립니다.
const PUBLIC_GUIDE = `g.published_title IS NOT NULL AND g.published_description IS NOT NULL AND g.published_image_key IS NOT NULL
  AND EXISTS (SELECT 1 FROM artist_applications a WHERE a.id = g.application_id AND ${PUBLIC_ARTIST})`;

export function findPublicGuide(db: ApiContext["DB"], id: string) {
  return db.prepare(`SELECT g.* FROM artwork_guides g WHERE g.id = ? AND ${PUBLIC_GUIDE}`).bind(id).first<GuideRow>();
}

export async function listPublicGuides(db: ApiContext["DB"], applicationId: string) {
  const { results } = await db.prepare(`SELECT g.id, g.published_title FROM artwork_guides g WHERE g.application_id = ? AND ${PUBLIC_GUIDE}
    ORDER BY g.published_at DESC LIMIT 12`).bind(applicationId).all<{ id: string; published_title: string }>();
  return results.map((row) => ({ id: row.id, title: row.published_title }));
}

import type { ApiContext } from "../lib/api-context";

// 방문객에게 보여도 되는 작가의 조건입니다. 공개 화면은 모두 이 조건을 함께 씁니다.
//  - 신청서가 승인 상태일 것
//  - 지도 공개를 끄지 않았을 것(값이 없거나 읽을 수 없는 예전 신청서는 지금 지도처럼 공개)
//  - 계정이 정지·삭제되지 않았을 것(계정 기록이 없는 예전 신청서는 공개)
// 데이터를 지우지 않으므로 다시 공개하거나 계정을 되살리면 그대로 돌아옵니다. SQL 별칭은 a입니다.
export const PUBLIC_ARTIST = `a.status = 'approved'
  AND CASE WHEN json_valid(a.payload_json) THEN json_type(a.payload_json, '$.values.mapPublished') IS NOT 'false' ELSE 1 END
  AND NOT EXISTS (SELECT 1 FROM accounts u WHERE u.id = a.account_id AND u.status IN ('suspended', 'deleted'))`;

export type PublicArtistRecord = { id: string; account_id: string; artist_name: string; email: string; payload_json: string; image_keys_json: string; created_at: string };
const COLUMNS = "a.id, a.account_id, a.artist_name, a.email, a.payload_json, a.image_keys_json, a.created_at";

export function findPublicArtist(db: ApiContext["DB"], id: string) {
  return db.prepare(`SELECT ${COLUMNS} FROM artist_applications a WHERE a.id = ? AND ${PUBLIC_ARTIST}`).bind(id).first<PublicArtistRecord>();
}

export async function listPublicArtists(db: ApiContext["DB"], limit = 100) {
  const { results } = await db.prepare(`SELECT ${COLUMNS} FROM artist_applications a WHERE ${PUBLIC_ARTIST} ORDER BY a.created_at DESC LIMIT ?`).bind(limit).all<PublicArtistRecord>();
  return results;
}

// 홈 통계입니다. 작가는 이메일 → 전화 → 작가명 순, 작업실은 공방명 → 주소 순으로 식별해 소문자로 묶어 셉니다.
export async function publicArtistCounts(db: ApiContext["DB"]) {
  const row = await db.prepare(`SELECT
    (SELECT COUNT(DISTINCT lower(COALESCE(NULLIF(trim(a.email), ''), NULLIF(trim(a.phone), ''), NULLIF(trim(a.artist_name), ''))))
       FROM artist_applications a WHERE ${PUBLIC_ARTIST}) AS artists,
    (SELECT COALESCE(SUM(CASE WHEN json_valid(a.payload_json) AND json_type(a.payload_json, '$.works') = 'array'
                              THEN json_array_length(a.payload_json, '$.works') ELSE 0 END), 0)
       FROM artist_applications a WHERE ${PUBLIC_ARTIST}) AS works,
    (SELECT COUNT(DISTINCT lower(COALESCE(NULLIF(trim(json_extract(a.payload_json, '$.values.studioName')), ''),
                                          NULLIF(trim(json_extract(a.payload_json, '$.values.address')), ''))))
       FROM artist_applications a WHERE ${PUBLIC_ARTIST} AND json_valid(a.payload_json)) AS spaces`)
    .first<{ artists: number; works: number; spaces: number }>();
  return { artists: row?.artists ?? 0, works: row?.works ?? 0, spaces: row?.spaces ?? 0 };
}

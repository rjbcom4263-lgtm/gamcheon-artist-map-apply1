import AgencyHome from "./AgencyHome";
import { env } from "cloudflare:workers";
import { requireSession } from "../admin/admin-auth";
import { statLabels } from "./content";

type HomeStatsRow = { artists: number; works: number; spaces: number; preparing: number };

// 홈 통계는 SQL에서 바로 집계합니다. 예전에는 전체 신청서의 payload_json을 매 요청 내려받아 JS에서 세었습니다.
// - artists: 승인 신청서를 이메일 → 전화 → 작가명 순으로 식별해 소문자로 묶은 수
// - works: 승인 신청서 payload의 works 배열 길이 합
// - spaces: 승인 신청서의 공방명 → 주소 순으로 식별해 소문자로 묶은 수
// - preparing: 접수·심사·보류 상태인 신청 수
const HOME_STATS_SQL = `SELECT
  (SELECT COUNT(DISTINCT lower(COALESCE(NULLIF(trim(email), ''), NULLIF(trim(phone), ''), NULLIF(trim(artist_name), ''))))
     FROM artist_applications WHERE status = 'approved') AS artists,
  (SELECT COALESCE(SUM(CASE WHEN json_valid(payload_json) AND json_type(payload_json, '$.works') = 'array'
                            THEN json_array_length(payload_json, '$.works') ELSE 0 END), 0)
     FROM artist_applications WHERE status = 'approved') AS works,
  (SELECT COUNT(DISTINCT lower(COALESCE(NULLIF(trim(json_extract(payload_json, '$.values.studioName')), ''),
                                        NULLIF(trim(json_extract(payload_json, '$.values.address')), ''))))
     FROM artist_applications WHERE status = 'approved' AND json_valid(payload_json)) AS spaces,
  (SELECT COUNT(*) FROM artist_applications WHERE status IN ('received', 'reviewing', 'hold')) AS preparing`;

async function getHomeStats() {
  const row = await env.DB.prepare(HOME_STATS_SQL).first<HomeStatsRow>();
  return [
    [statLabels[0][0], row?.artists ?? 0, statLabels[0][1]],
    [statLabels[1][0], row?.works ?? 0, statLabels[1][1]],
    [statLabels[2][0], row?.spaces ?? 0, statLabels[2][1]],
    [statLabels[3][0], row?.preparing ?? 0, statLabels[3][1]],
  ] as [string, number, string][];
}

export default async function HomePage() {
  const user = await requireSession();
  const stats = await getHomeStats();
  return <AgencyHome user={user ? { role: user.role } : null} stats={stats} />;
}

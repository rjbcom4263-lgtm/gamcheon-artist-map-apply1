import AgencyHome from "./AgencyHome";
import { env } from "cloudflare:workers";
import { requireSession } from "../admin/admin-auth";
import { publicArtistCounts } from "../artists/public-artist-query";
import { statLabels } from "./content";

// 홈 통계는 SQL에서 바로 집계합니다. 작가·작품·작업실은 공개 작가만 세고, preparing은 접수·심사·보류 상태인 신청 수입니다.
const PREPARING_SQL = "SELECT COUNT(*) AS preparing FROM artist_applications WHERE status IN ('received', 'reviewing', 'hold')";

async function getHomeStats() {
  const [counts, waiting] = await Promise.all([
    publicArtistCounts(env.DB),
    env.DB.prepare(PREPARING_SQL).first<{ preparing: number }>(),
  ]);
  return [
    [statLabels[0][0], counts.artists, statLabels[0][1]],
    [statLabels[1][0], counts.works, statLabels[1][1]],
    [statLabels[2][0], counts.spaces, statLabels[2][1]],
    [statLabels[3][0], waiting?.preparing ?? 0, statLabels[3][1]],
  ] as [string, number, string][];
}

export default async function HomePage() {
  const user = await requireSession();
  const stats = await getHomeStats();
  return <AgencyHome user={user ? { role: user.role } : null} stats={stats} />;
}

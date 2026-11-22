import { env } from "cloudflare:workers";
import FullArtistMap from "./FullArtistMap";
import { artistRowsToPlaces } from "./map-artists";
import { listPublicArtists } from "../artists/public-artist-query";
import { requireSession } from "../admin/admin-auth";
import { Header } from "../home/SectionPage";

export const dynamic = "force-dynamic";

async function getArtists() {
  try {
    return artistRowsToPlaces(await listPublicArtists(env.DB));
  } catch (error) {
    console.error("artist map data failed", error);
    return [];
  }
}

export default async function MapPage({ searchParams }: { searchParams: Promise<{ artist?: string }> }) {
  const [{ artist }, user, places] = await Promise.all([searchParams, requireSession(), getArtists()]);
  // 넓은 화면에서는 홈페이지와 같은 헤더(메뉴·로그인)를 그대로 씁니다. 휴대폰에서는 FullArtistMap의 짧은 헤더가 대신합니다.
  const header = <Header user={user ? { role: user.role } : null} activeHref="/map" className="map-site-header"/>;
  return <FullArtistMap initialPlaces={places} initialArtistId={artist} siteHeader={header} />;
}

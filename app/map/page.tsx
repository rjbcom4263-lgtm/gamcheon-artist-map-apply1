import { env } from "cloudflare:workers";
import FullArtistMap from "./FullArtistMap";
import { artistRowsToPlaces } from "./map-artists";
import { listPublicArtists } from "../artists/public-artist-query";

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
  const { artist } = await searchParams;
  return <FullArtistMap initialPlaces={await getArtists()} initialArtistId={artist} />;
}

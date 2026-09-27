import { env } from "cloudflare:workers";
import MobileArtMap from "./MobileArtMap";
import { artistRowsToPlaces } from "./map-artists";
import type { ArtistRow } from "./map-artists";

export const dynamic = "force-dynamic";

async function getArtists() {
  try {
    const result = await env.DB.prepare(`SELECT id, artist_name, payload_json, image_keys_json
      FROM artist_applications WHERE status = 'approved' ORDER BY created_at DESC LIMIT 100`).all<ArtistRow>();
    return artistRowsToPlaces(result.results || []);
  } catch (error) {
    console.error("artist map data failed", error);
    return [];
  }
}

export default async function MapPage({ searchParams }: { searchParams: Promise<{ artist?: string }> }) {
  const { artist } = await searchParams;
  return <MobileArtMap initialPlaces={await getArtists()} initialArtistId={artist} />;
}

import { env } from "cloudflare:workers";
import { notFound } from "next/navigation";
import ArtistDetail from "./ArtistDetail";
import { artistRowToProfile, type PublicArtistRow } from "../public-artist";

export const dynamic = "force-dynamic";

export default async function PublicArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await env.DB.prepare(`SELECT id, artist_name, payload_json, image_keys_json
    FROM artist_applications WHERE id = ? AND status = 'approved'`).bind(id).first<PublicArtistRow>();
  const artist = row ? artistRowToProfile(row) : null;
  if (!artist) notFound();
  return <ArtistDetail artist={artist}/>;
}

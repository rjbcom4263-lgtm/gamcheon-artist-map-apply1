import { env } from "cloudflare:workers";
import { notFound } from "next/navigation";
import ArtistDetail, { type GuideLink } from "./ArtistDetail";
import StatBeacon from "../../StatBeacon";
import { artistRowToProfile, type PublicArtistRow } from "../public-artist";

export const dynamic = "force-dynamic";

type GuideRow = { id: string; published_title: string };

/** 이 작가의 공개된 작품 해설(/w/[id])만 고릅니다. 공개 조건은 app/w/[id]/page.tsx와 같습니다. */
async function getPublishedGuides(applicationId: string): Promise<GuideLink[]> {
  try {
    const result = await env.DB.prepare(`SELECT id, published_title FROM artwork_guides
      WHERE application_id = ? AND published_title IS NOT NULL AND published_description IS NOT NULL AND published_image_key IS NOT NULL
      ORDER BY published_at DESC LIMIT 12`).bind(applicationId).all<GuideRow>();
    return (result.results || []).map((row) => ({ id: row.id, title: row.published_title }));
  } catch (error) {
    console.error("artist guides failed", error);
    return [];
  }
}

export default async function PublicArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await env.DB.prepare(`SELECT id, artist_name, payload_json, image_keys_json, created_at
    FROM artist_applications WHERE id = ? AND status = 'approved'`).bind(id).first<PublicArtistRow>();
  const artist = row ? artistRowToProfile(row) : null;
  if (!artist) notFound();
  const guides = await getPublishedGuides(artist.id);
  return <><ArtistDetail artist={artist} guides={guides}/><StatBeacon kind="view" id={artist.id}/></>;
}

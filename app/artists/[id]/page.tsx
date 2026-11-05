import { env } from "cloudflare:workers";
import { notFound } from "next/navigation";
import ArtistDetail, { type GuideLink } from "./ArtistDetail";
import StatBeacon from "../../StatBeacon";
import { artistRowToProfile } from "../public-artist";
import { findPublicArtist } from "../public-artist-query";
import { listPublicGuides } from "../../work-guides/public-guide";

export const dynamic = "force-dynamic";

/** 이 작가의 공개된 작품 해설(/w/[id])만 고릅니다. 공개 조건은 work-guides/public-guide.ts에 있습니다. */
async function getPublishedGuides(applicationId: string): Promise<GuideLink[]> {
  try {
    return await listPublicGuides(env.DB, applicationId);
  } catch (error) {
    console.error("artist guides failed", error);
    return [];
  }
}

export default async function PublicArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await findPublicArtist(env.DB, id);
  const artist = row ? artistRowToProfile(row) : null;
  if (!artist) notFound();
  const guides = await getPublishedGuides(artist.id);
  return <><ArtistDetail artist={artist} guides={guides}/><StatBeacon kind="view" id={artist.id}/></>;
}

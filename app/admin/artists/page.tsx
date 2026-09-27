import { env } from "cloudflare:workers";
import { redirect } from "next/navigation";
import { requireAdmin } from "../admin-auth";
import PublicArtistManager, { type ManagedArtist } from "./PublicArtistManager";

export const dynamic = "force-dynamic";

export default async function PublicArtistsPage({ searchParams }: { searchParams: Promise<{ artist?: string }> }) {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const { artist } = await searchParams;

  const result = await env.DB.prepare(`SELECT id, artist_name, payload_json, image_keys_json, created_at
    FROM artist_applications WHERE status = 'approved' ORDER BY created_at DESC LIMIT 1000`).all<ManagedArtist>();

  return <PublicArtistManager initial={result.results || []} adminName={admin.displayName} initialSelectedId={artist}/>;
}

import { env } from "cloudflare:workers";
import { redirect } from "next/navigation";
import { requireArtist } from "../../admin/admin-auth";
import { artistRowToProfile, type PublicArtistRow } from "../../artists/public-artist";
import ProfileEditForm from "../ProfileEditForm";
import { ensureApplicationsTable, linkLegacyApplication } from "../../applications-db";

export const dynamic = "force-dynamic";

type ArtistRow = PublicArtistRow & { payload_json: string; image_keys_json: string };
type Payload = { values?: Record<string, unknown>; categories?: string[]; works?: Array<{ id?: string; title?: string; status?: string; description?: string }> };
function parse<T>(value: string, fallback: T): T { try { return JSON.parse(value) as T; } catch { return fallback; } }

export default async function ArtistProfileEditPage() {
  const viewer = await requireArtist();
  if (!viewer) redirect("/login");
  await ensureApplicationsTable();
  const account = await env.DB.prepare("SELECT id, display_name, login_id, phone, email FROM accounts WHERE id = ?")
    .bind(viewer.accountId).first<{ id: string; display_name: string; login_id: string; phone: string; email: string }>();
  if (account) await linkLegacyApplication({ id: account.id, displayName: account.display_name || account.login_id, phone: account.phone, email: account.email });
  const row = await env.DB.prepare(`SELECT id, artist_name, payload_json, image_keys_json FROM artist_applications
    WHERE status = 'approved' AND account_id = ? ORDER BY created_at DESC LIMIT 1`)
    .bind(viewer.accountId).first<ArtistRow>();
  if (!row) redirect("/artist");
  const artist = artistRowToProfile(row, true);
  if (!artist) redirect("/artist");
  return <ProfileEditForm applicationId={row.id} artist={artist} payload={parse<Payload>(row.payload_json, {})}/>;
}

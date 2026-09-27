import { env } from "cloudflare:workers";
import { requireArtist } from "../../../admin/admin-auth";
import { ensureApplicationsTable } from "../../../applications-db";

export const runtime = "edge";

type ApplicationImageRow = { image_keys_json: string };
type ImageRecord = { key?: string };

export async function GET(request: Request) {
  const artist = await requireArtist();
  if (!artist) return new Response("Forbidden", { status: 403 });
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!key.startsWith("applications/") || key.includes("..")) return new Response("Bad request", { status: 400 });

  await ensureApplicationsTable();
  const linked = await env.DB.prepare(`SELECT image_keys_json FROM artist_applications
    WHERE account_id = ?
    ORDER BY created_at DESC
    LIMIT 20`).bind(artist.accountId).all<ApplicationImageRow>();
  const allowed = (linked.results || []).some((row) => {
    try {
      const images = JSON.parse(row.image_keys_json) as ImageRecord[];
      return images.some((image) => image.key === key);
    } catch { return false; }
  });
  if (!allowed) return new Response("Forbidden", { status: 403 });

  const object = await env.BUCKET.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("cache-control", "private, max-age=300");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}

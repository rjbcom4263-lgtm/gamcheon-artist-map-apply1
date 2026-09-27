import { env } from "cloudflare:workers";

export const runtime = "edge";

type ImageRecord = { key?: string };
type ArtistImagesRow = { image_keys_json: string };

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!key.startsWith("applications/") || key.includes("..")) return new Response("Bad request", { status: 400 });

  const rows = await env.DB.prepare("SELECT image_keys_json FROM artist_applications WHERE status = 'approved'").all<ArtistImagesRow>();
  const allowed = (rows.results || []).some((row) => {
    try { return (JSON.parse(row.image_keys_json) as ImageRecord[]).some((image) => image.key === key); } catch { return false; }
  });
  if (!allowed) return new Response("Not found", { status: 404 });

  const object = await env.BUCKET.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("cache-control", "public, max-age=300");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}

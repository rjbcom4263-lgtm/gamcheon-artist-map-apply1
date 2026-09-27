import { env } from "cloudflare:workers";

export const runtime = "edge";

export async function GET(_request: Request, { params }: { params: Promise<{ z: string; x: string; y: string }> }) {
  const { z, x, y } = await params;
  if (![z, x, y].every((value) => /^\d+$/.test(value))) return new Response("Bad request", { status: 400 });
  const key = `map-tiles/${z}/${x}/${y}.png`;
  const object = await env.BUCKET.get(key);
  if (!object) return new Response("Not found", { status: 404, headers: { "cache-control": "public, max-age=30" } });
  const headers = new Headers({ "content-type": "image/png", "cache-control": "public, max-age=300", "x-content-type-options": "nosniff" });
  return new Response(object.body, { headers });
}

import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../admin/admin-auth";

export const runtime = "edge";

async function ensureTable() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS map_tiles (
    id TEXT PRIMARY KEY NOT NULL,
    zoom INTEGER NOT NULL,
    tile_x INTEGER NOT NULL,
    tile_y INTEGER NOT NULL,
    object_key TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL DEFAULT 'kakao-capture',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(zoom, tile_x, tile_y)
  )`).run();
}

function integer(value: FormDataEntryValue | null) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

export async function GET() {
  if (!await requireAdmin()) return new Response("Forbidden", { status: 403 });
  await ensureTable();
  const result = await env.DB.prepare("SELECT id, zoom, tile_x, tile_y, object_key, source, active, created_at FROM map_tiles ORDER BY zoom DESC, tile_y, tile_x").all();
  return Response.json({ tiles: result.results || [] });
}

export async function POST(request: Request) {
  if (!await requireAdmin()) return new Response("Forbidden", { status: 403 });
  try {
    await ensureTable();
    const form = await request.formData();
    const zoom = integer(form.get("zoom"));
    const tileX = integer(form.get("tileX"));
    const tileY = integer(form.get("tileY"));
    const image = form.get("image");
    if (zoom === null || tileX === null || tileY === null) return Response.json({ error: "타일 좌표를 확인해주세요." }, { status: 400 });
    if (!image || typeof image === "string" || !image.size || !image.type.startsWith("image/")) return Response.json({ error: "PNG 또는 이미지 파일을 선택해주세요." }, { status: 400 });
    if (image.size > 8 * 1024 * 1024) return Response.json({ error: "타일 이미지는 8MB 이하로 올려주세요." }, { status: 400 });

    const objectKey = `map-tiles/${zoom}/${tileX}/${tileY}.png`;
    await env.BUCKET.put(objectKey, image.stream(), {
      httpMetadata: { contentType: "image/png", cacheControl: "public, max-age=300" },
      customMetadata: { source: "kakao-capture", originalName: image.name.slice(0, 160) },
    });
    const id = `TILE-${crypto.randomUUID()}`;
    await env.DB.prepare(`INSERT INTO map_tiles (id, zoom, tile_x, tile_y, object_key)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(zoom, tile_x, tile_y) DO UPDATE SET object_key = excluded.object_key, active = 1, created_at = CURRENT_TIMESTAMP`)
      .bind(id, zoom, tileX, tileY, objectKey).run();
    return Response.json({ tile: { zoom, tileX, tileY, objectKey, url: `/api/map-tiles/${zoom}/${tileX}/${tileY}` } });
  } catch (error) {
    console.error("map tile upload failed", error);
    return Response.json({ error: "타일을 저장하지 못했습니다. 잠시 뒤 다시 시도해주세요." }, { status: 500 });
  }
}

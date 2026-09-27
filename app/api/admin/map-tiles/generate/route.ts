import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../admin/admin-auth";

export const runtime = "edge";
const MUAPI_URL = "https://api.muapi.ai";

async function ensureTable() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS map_tiles (
    id TEXT PRIMARY KEY NOT NULL, zoom INTEGER NOT NULL, tile_x INTEGER NOT NULL, tile_y INTEGER NOT NULL,
    object_key TEXT NOT NULL UNIQUE, source TEXT NOT NULL DEFAULT 'kakao-capture', active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(zoom, tile_x, tile_y)
  )`).run();
}
function integer(value: FormDataEntryValue | null) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}
async function muapi(path: string, key: string, init: RequestInit) {
  const headers = new Headers(init.headers); headers.set("x-api-key", key);
  return fetch(`${MUAPI_URL}${path}`, { ...init, headers });
}

export async function POST(request: Request) {
  if (!await requireAdmin()) return new Response("Forbidden", { status: 403 });
  const key = process.env.MUAPI_API_KEY || "";
  if (!key) return Response.json({ error: "MUAPI_API_KEY가 아직 등록되지 않았습니다." }, { status: 503 });
  try {
    await ensureTable();
    const form = await request.formData();
    const zoom = integer(form.get("zoom")); const tileX = integer(form.get("tileX")); const tileY = integer(form.get("tileY"));
    const prompt = typeof form.get("prompt") === "string" ? String(form.get("prompt")).trim().slice(0, 3000) : "";
    const image = form.get("image");
    if (zoom === null || tileX === null || tileY === null) return Response.json({ error: "타일 좌표를 확인해주세요." }, { status: 400 });
    if (!prompt) return Response.json({ error: "스타일 변환 프롬프트를 입력해주세요." }, { status: 400 });
    if (!image || typeof image === "string" || !image.size || !image.type.startsWith("image/")) return Response.json({ error: "캡처한 타일 이미지를 선택해주세요." }, { status: 400 });
    if (image.size > 8 * 1024 * 1024) return Response.json({ error: "타일 이미지는 8MB 이하로 올려주세요." }, { status: 400 });

    const upload = new FormData(); upload.set("file", image, image.name || "kakao-tile.png");
    const uploadResponse = await muapi("/api/v1/upload_file", key, { method: "POST", body: upload });
    if (!uploadResponse.ok) return Response.json({ error: `MuAPI 이미지 업로드 실패 (${uploadResponse.status})` }, { status: 502 });
    const uploaded = await uploadResponse.json() as { url?: string; file_url?: string; data?: { url?: string } };
    const imageUrl = uploaded.url || uploaded.file_url || uploaded.data?.url;
    if (!imageUrl) return Response.json({ error: "MuAPI가 이미지 주소를 반환하지 않았습니다." }, { status: 502 });

    const fullPrompt = `${prompt}\n\nPreserve the exact road layout, building positions, stairs, coastline, and geographic composition of the reference tile. Do not add text, labels, logos, or new roads. Create a clean flat 2D map tile suitable for a web map.`;
    const submitResponse = await muapi("/api/v1/nano-banana", key, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: fullPrompt, image_url: imageUrl, aspect_ratio: "1:1" }) });
    if (!submitResponse.ok) return Response.json({ error: `MuAPI 이미지 생성 요청 실패 (${submitResponse.status})` }, { status: 502 });
    const submitted = await submitResponse.json() as { request_id?: string; id?: string; url?: string; output?: { url?: string } };
    const requestId = submitted.request_id || submitted.id; let outputUrl = submitted.url || submitted.output?.url || "";
    if (requestId && !outputUrl) for (let attempt = 0; attempt < 90; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const resultResponse = await muapi(`/api/v1/predictions/${encodeURIComponent(requestId)}/result`, key, { method: "GET" });
      if (!resultResponse.ok) continue;
      const result = await resultResponse.json() as { outputs?: string[]; url?: string; output?: { url?: string } };
      outputUrl = result.outputs?.[0] || result.url || result.output?.url || "";
      if (outputUrl) break;
    }
    if (!outputUrl) return Response.json({ error: "이미지 생성 시간이 초과되었습니다. 다시 시도해주세요." }, { status: 504 });
    const generated = await fetch(outputUrl);
    if (!generated.ok || !generated.body) return Response.json({ error: "생성된 이미지를 가져오지 못했습니다." }, { status: 502 });
    const objectKey = `map-tiles/${zoom}/${tileX}/${tileY}.png`;
    await env.BUCKET.put(objectKey, generated.body, { httpMetadata: { contentType: "image/png", cacheControl: "public, max-age=300" }, customMetadata: { source: "muapi-nano-banana", prompt } });
    const id = `TILE-${crypto.randomUUID()}`;
    await env.DB.prepare(`INSERT INTO map_tiles (id, zoom, tile_x, tile_y, object_key, source) VALUES (?, ?, ?, ?, ?, 'muapi-nano-banana')
      ON CONFLICT(zoom, tile_x, tile_y) DO UPDATE SET object_key = excluded.object_key, source = excluded.source, active = 1, created_at = CURRENT_TIMESTAMP`).bind(id, zoom, tileX, tileY, objectKey).run();
    return Response.json({ tile: { zoom, tileX, tileY, objectKey, source: "muapi-nano-banana", url: `/api/map-tiles/${zoom}/${tileX}/${tileY}` } });
  } catch (error) {
    console.error("map tile generation failed", error);
    return Response.json({ error: "AI 타일 변환에 실패했습니다. 잠시 뒤 다시 시도해주세요." }, { status: 500 });
  }
}

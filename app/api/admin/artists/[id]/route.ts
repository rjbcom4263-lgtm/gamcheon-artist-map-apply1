import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../admin/admin-auth";

export const runtime = "edge";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return Response.json({ error: "권한이 없습니다." }, { status: 403 });
  const body = await request.json().catch(() => null) as { published?: unknown; mapX?: unknown; mapY?: unknown; mapLongitude?: unknown; mapLatitude?: unknown } | null;
  if (!body || typeof body.published !== "boolean") return Response.json({ error: "공개 상태가 올바르지 않습니다." }, { status: 400 });

  const hasGeo = "mapLongitude" in body || "mapLatitude" in body;
  const clearGeo = body.mapLongitude === null && body.mapLatitude === null;
  if (hasGeo && !clearGeo && (typeof body.mapLongitude !== "number" || typeof body.mapLatitude !== "number"
    || !Number.isFinite(body.mapLongitude) || !Number.isFinite(body.mapLatitude)
    || body.mapLongitude < 128.9998 || body.mapLongitude > 129.0174 || body.mapLatitude < 35.0867 || body.mapLatitude > 35.1023)) {
    return Response.json({ error: "새 지도 위치가 범위를 벗어났습니다." }, { status: 400 });
  }
  const clearPosition = body.mapX === null && body.mapY === null;
  const x = Number(body.mapX);
  const y = Number(body.mapY);
  if (!hasGeo && !clearPosition && (!Number.isFinite(x) || !Number.isFinite(y) || x < 5 || x > 95 || y < 12 || y > 78)) {
    return Response.json({ error: "지도 위치가 범위를 벗어났습니다." }, { status: 400 });
  }

  const { id } = await context.params;
  const current = await env.DB.prepare("SELECT payload_json FROM artist_applications WHERE id = ? AND status = 'approved'").bind(id).first<{ payload_json: string }>();
  if (!current) return Response.json({ error: "승인된 작가를 찾을 수 없습니다." }, { status: 404 });

  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(current.payload_json); } catch {}
  const values = typeof payload.values === "object" && payload.values ? { ...payload.values as Record<string, unknown> } : {};
  values.mapPublished = body.published;
  if (hasGeo) {
    if (clearGeo) { delete values.mapLongitude; delete values.mapLatitude; }
    else { values.mapLongitude = Math.round((body.mapLongitude as number) * 1_000_000) / 1_000_000; values.mapLatitude = Math.round((body.mapLatitude as number) * 1_000_000) / 1_000_000; }
  } else if (clearPosition) { delete values.mapX; delete values.mapY; }
  else { values.mapX = Math.round(x * 100) / 100; values.mapY = Math.round(y * 100) / 100; }
  payload.values = values;
  const payloadJson = JSON.stringify(payload);
  await env.DB.prepare("UPDATE artist_applications SET payload_json = ? WHERE id = ? AND status = 'approved'").bind(payloadJson, id).run();
  return Response.json({ ok: true, payload_json: payloadJson });
}

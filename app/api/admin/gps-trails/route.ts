import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../admin/admin-auth";
import { ensureMapAlleyTables, insideLimits, MAX_TRAIL_POINTS } from "../../../map/map-alleys-db";
import type { TrailPoint } from "../../../map/map-alleys-db";

export const runtime = "edge";

// 관리자가 골목을 걸으며 남긴 GPS 기록입니다. 관리자만 읽고 쓰며 공개 지도에는 나가지 않습니다.
export async function GET() {
  if (!await requireAdmin()) return new Response("Forbidden", { status: 403 });
  await ensureMapAlleyTables();
  const { results } = await env.DB.prepare("SELECT id, started_at, points_json FROM gps_trails ORDER BY started_at")
    .all<{ id: string; started_at: string; points_json: string }>();
  return Response.json({
    trails: results.map((row) => ({ id: row.id, startedAt: row.started_at, points: JSON.parse(row.points_json) })),
  }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  if (!await requireAdmin()) return new Response("Forbidden", { status: 403 });
  try {
    const body = await request.json() as { id?: unknown; startedAt?: unknown; points?: unknown };
    if (typeof body.id !== "string" || !body.id || body.id.length > 80 || typeof body.startedAt !== "string" || Number.isNaN(Date.parse(body.startedAt))
      || !Array.isArray(body.points) || body.points.length > MAX_TRAIL_POINTS) {
      return Response.json({ error: `기록 형식이 맞지 않거나 너무 깁니다(최대 ${MAX_TRAIL_POINTS}점).` }, { status: 400 });
    }
    // 감천 작업 범위 밖의 점은 저장하지 않습니다.
    const points: TrailPoint[] = body.points.flatMap((point: unknown) => {
      if (!Array.isArray(point) || point.length !== 4 || !point.every((part) => typeof part === "number" && Number.isFinite(part))) return [];
      const [lng, lat, accuracy, time] = point as TrailPoint;
      return insideLimits(lng, lat)
        ? [[Math.round(lng * 1e7) / 1e7, Math.round(lat * 1e7) / 1e7, Math.round(accuracy * 10) / 10, Math.round(time)] as TrailPoint]
        : [];
    });
    if (points.length < 5) return Response.json({ error: "감천 작업 범위 안에서 기록한 위치가 너무 적습니다." }, { status: 400 });
    const startedAt = new Date(body.startedAt).toISOString();
    await ensureMapAlleyTables();
    await env.DB.prepare(`INSERT INTO gps_trails (id, started_at, points_json) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET points_json = excluded.points_json`)
      .bind(body.id, startedAt, JSON.stringify(points)).run();
    return Response.json({ trail: { id: body.id, startedAt, points } });
  } catch (error) {
    console.error("gps trail save failed", error);
    return Response.json({ error: "기록을 저장하지 못했습니다." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!await requireAdmin()) return new Response("Forbidden", { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "지울 기록을 알려주세요." }, { status: 400 });
  await ensureMapAlleyTables();
  await env.DB.prepare("DELETE FROM gps_trails WHERE id = ?").bind(id).run();
  return Response.json({ ok: true });
}

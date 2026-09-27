import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../admin/admin-auth";

export const runtime = "edge";

const LIMITS = { west: 129.006, south: 35.09274, east: 129.0135, north: 35.0992 };

async function ensureTable() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS map_boundary (
    id TEXT PRIMARY KEY NOT NULL DEFAULT 'active',
    coordinates_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

export async function GET() {
  if (!await requireAdmin()) return new Response("Forbidden", { status: 403 });
  await ensureTable();
  const row = await env.DB.prepare("SELECT coordinates_json, updated_at FROM map_boundary WHERE id = 'active'").first<{ coordinates_json: string; updated_at: string }>();
  return Response.json({ coordinates: row ? JSON.parse(row.coordinates_json) : [], updatedAt: row?.updated_at ?? null });
}

export async function PUT(request: Request) {
  if (!await requireAdmin()) return new Response("Forbidden", { status: 403 });
  try {
    const body = await request.json() as { coordinates?: unknown };
    const points = body.coordinates;
    if (!Array.isArray(points) || points.length > 200 || (points.length > 0 && points.length < 3)) {
      return Response.json({ error: "경계는 비우거나 3~200개 지점으로 지정해주세요." }, { status: 400 });
    }
    if (!points.every((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)
      && point[0] >= LIMITS.west && point[0] <= LIMITS.east && point[1] >= LIMITS.south && point[1] <= LIMITS.north)) {
      return Response.json({ error: "지도에 표시된 감천 작업 범위 안에서 경계를 지정해주세요." }, { status: 400 });
    }
    if (points.length > 0 && new Set((points as [number, number][]).map(([lng, lat]) => `${lng},${lat}`)).size < 3) {
      return Response.json({ error: "서로 다른 지점을 3개 이상 지정해주세요." }, { status: 400 });
    }
    await ensureTable();
    await env.DB.prepare(`INSERT INTO map_boundary (id, coordinates_json, updated_at) VALUES ('active', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET coordinates_json = excluded.coordinates_json, updated_at = CURRENT_TIMESTAMP`)
      .bind(JSON.stringify(points)).run();
    return Response.json({ coordinates: points });
  } catch (error) {
    console.error("map boundary save failed", error);
    return Response.json({ error: "경계를 저장하지 못했습니다. 잠시 뒤 다시 시도해주세요." }, { status: 500 });
  }
}

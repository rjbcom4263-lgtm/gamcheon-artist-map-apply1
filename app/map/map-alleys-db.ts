import { env } from "cloudflare:workers";

// 골목지도의 골목길(관리자가 그리거나 GPS 기록으로 찾아 확인한 길)과 관리자 GPS 기록을 D1에 저장합니다.
// 감천 작업 범위 밖의 좌표는 받지 않습니다(GPS 기록은 범위 밖 점을 버려 집·이동 경로가 남지 않게 함).
export const MAP_LIMITS = { west: 129.006, south: 35.09274, east: 129.0135, north: 35.0992 };

export type LngLat = [number, number];
export type Alley = { id: string; name?: string; coordinates: LngLat[]; widthMeters: number };
export type TrailPoint = [number, number, number, number];

const MAX_ALLEYS = 500;
const MAX_LINE_POINTS = 500;
export const MAX_TRAIL_POINTS = 10000;

export const insideLimits = (lng: number, lat: number) =>
  lng >= MAP_LIMITS.west && lng <= MAP_LIMITS.east && lat >= MAP_LIMITS.south && lat <= MAP_LIMITS.north;

function cleanLine(value: unknown): LngLat[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > MAX_LINE_POINTS) return null;
  const line: LngLat[] = [];
  for (const point of value) {
    if (!Array.isArray(point) || point.length !== 2 || !point.every((part) => typeof part === "number" && Number.isFinite(part))) return null;
    if (!insideLimits(point[0], point[1])) return null;
    line.push([Math.round(point[0] * 1e7) / 1e7, Math.round(point[1] * 1e7) / 1e7]);
  }
  return line;
}

export function cleanAlleys(value: unknown): Alley[] | null {
  if (!Array.isArray(value) || value.length > MAX_ALLEYS) return null;
  const alleys: Alley[] = [];
  for (const item of value) {
    const alley = item as Partial<Alley> | null;
    if (!alley || typeof alley.id !== "string" || !alley.id || alley.id.length > 80) return null;
    if (alley.name !== undefined && (typeof alley.name !== "string" || alley.name.length > 60)) return null;
    const width = Number(alley.widthMeters);
    if (!Number.isFinite(width) || width < 1 || width > 8) return null;
    const coordinates = cleanLine(alley.coordinates);
    if (!coordinates) return null;
    alleys.push({ id: alley.id, ...(alley.name ? { name: alley.name } : {}), coordinates, widthMeters: width });
  }
  return alleys;
}

export function cleanLines(value: unknown): LngLat[][] | null {
  if (!Array.isArray(value) || value.length > MAX_ALLEYS) return null;
  const lines: LngLat[][] = [];
  for (const item of value) {
    const line = cleanLine(item);
    if (!line) return null;
    lines.push(line);
  }
  return lines;
}

export async function ensureMapAlleyTables() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS map_alleys (
    id TEXT PRIMARY KEY NOT NULL DEFAULT 'active',
    alleys_json TEXT NOT NULL,
    dismissed_json TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS gps_trails (
    id TEXT PRIMARY KEY NOT NULL,
    started_at TEXT NOT NULL,
    points_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

export async function readMapAlleys() {
  await ensureMapAlleyTables();
  const row = await env.DB.prepare("SELECT alleys_json, dismissed_json, updated_at FROM map_alleys WHERE id = 'active'")
    .first<{ alleys_json: string; dismissed_json: string; updated_at: string }>();
  return {
    alleys: row ? cleanAlleys(JSON.parse(row.alleys_json)) ?? [] : [],
    dismissed: row ? cleanLines(JSON.parse(row.dismissed_json)) ?? [] : [],
    updatedAt: row?.updated_at ?? null,
  };
}

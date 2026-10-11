import { env } from "cloudflare:workers";

// 골목지도 작업실 '건물' 탭에서 고친 지도 건물(높이·색·지붕·숨기기)을 D1에 저장합니다.
// 초안(draft, 작업실에서만 보임)과 공개본(published, 공개 지도) 두 벌을 두고, '공개하기'로 초안을 공개본에 옮깁니다.
// 형식은 골목지도의 buildingEdits.ts와 같습니다: { overrides: { [OSM 건물 번호]: { hidden?, heightMeters?, wallColor?, roofColor?, roofStyle? } } }

export type BuildingOverride = { hidden?: boolean; heightMeters?: number; wallColor?: number; roofColor?: number; roofStyle?: "flat" | "gable" };
export type BuildingEdits = { overrides: Record<string, BuildingOverride> };

const MAX_OVERRIDES = 3000;
const isColor = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 0xffffff;

// 받은 값을 검사합니다. 하나라도 잘못되면 null(저장하지 않음).
export function cleanBuildingEdits(value: unknown): BuildingEdits | null {
  const input = (value as { overrides?: unknown } | null)?.overrides;
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length > MAX_OVERRIDES) return null;
  const overrides: Record<string, BuildingOverride> = {};
  for (const [id, raw] of entries) {
    if (!/^\d{1,15}$/.test(id) || !raw || typeof raw !== "object") return null;
    const item = raw as Record<string, unknown>;
    const override: BuildingOverride = {};
    if (item.hidden !== undefined) { if (typeof item.hidden !== "boolean") return null; if (item.hidden) override.hidden = true; }
    if (item.heightMeters !== undefined) {
      const height = Number(item.heightMeters);
      if (!Number.isFinite(height) || height < 2.5 || height > 60) return null;
      override.heightMeters = Math.round(height * 100) / 100;
    }
    for (const key of ["wallColor", "roofColor"] as const) {
      if (item[key] === undefined) continue;
      if (!isColor(item[key])) return null;
      override[key] = item[key] as number;
    }
    if (item.roofStyle !== undefined) {
      if (item.roofStyle !== "flat" && item.roofStyle !== "gable") return null;
      override.roofStyle = item.roofStyle;
    }
    if (Object.keys(override).length) overrides[id] = override;
  }
  return { overrides };
}

const EMPTY: BuildingEdits = { overrides: {} };

export async function ensureMapBuildingTable() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS map_building_edits (
    id TEXT PRIMARY KEY NOT NULL CHECK (id IN ('draft', 'published')),
    edits_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

async function read(id: "draft" | "published") {
  const row = await env.DB.prepare("SELECT edits_json, updated_at FROM map_building_edits WHERE id = ?").bind(id)
    .first<{ edits_json: string; updated_at: string }>();
  return { edits: row ? cleanBuildingEdits(JSON.parse(row.edits_json)) ?? EMPTY : EMPTY, updatedAt: row?.updated_at ?? null, exists: Boolean(row) };
}

export async function readBuildingEdits() {
  await ensureMapBuildingTable();
  const [draft, published] = await Promise.all([read("draft"), read("published")]);
  // 초안을 한 번도 저장하지 않았으면 공개본을 초안으로 씁니다.
  return { draft: draft.exists ? draft.edits : published.edits, published: published.edits, draftUpdatedAt: draft.updatedAt, publishedAt: published.updatedAt };
}

export async function readPublishedBuildingEdits() {
  await ensureMapBuildingTable();
  const published = await read("published");
  return { edits: published.edits, publishedAt: published.updatedAt };
}

export async function writeBuildingEdits(id: "draft" | "published", edits: BuildingEdits) {
  await ensureMapBuildingTable();
  await env.DB.prepare(`INSERT INTO map_building_edits (id, edits_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET edits_json = excluded.edits_json, updated_at = CURRENT_TIMESTAMP`)
    .bind(id, JSON.stringify(edits)).run();
}

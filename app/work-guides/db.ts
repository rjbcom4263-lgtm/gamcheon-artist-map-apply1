import { env } from "cloudflare:workers";
import { GUIDE_LANGUAGES, type Translation } from "./shared";

export type GuideRow = {
  id: string; account_id: string; application_id: string; artist_name: string;
  pending_title: string | null; pending_description: string | null; pending_image_key: string | null;
  published_title: string | null; published_description: string | null; published_image_key: string | null;
  translations_json: string; submitted_at: string | null; published_at: string | null;
  pending_revision: number; created_at: string;
};

export async function ensureWorkGuidesTable() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS artwork_guides (
    id TEXT PRIMARY KEY NOT NULL,
    account_id TEXT NOT NULL,
    application_id TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    pending_title TEXT,
    pending_description TEXT,
    pending_image_key TEXT,
    published_title TEXT,
    published_description TEXT,
    published_image_key TEXT,
    translations_json TEXT NOT NULL DEFAULT '{}',
    submitted_at TEXT,
    published_at TEXT,
    pending_revision INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_artwork_guides_account ON artwork_guides (account_id)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_artwork_guides_submitted ON artwork_guides (submitted_at)").run();
}

export async function getGuide(id: string) {
  return env.DB.prepare("SELECT * FROM artwork_guides WHERE id = ?").bind(id).first<GuideRow>();
}

export function guideStatus(row: GuideRow) {
  return row.pending_title ? "pending" : row.published_title ? "published" : "draft";
}

export function parseTranslations(value: string): Record<string, Translation> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(GUIDE_LANGUAGES.flatMap(({ code }) => {
      const item = (parsed as Record<string, unknown>)[code];
      if (!item || typeof item !== "object") return [];
      const text = item as Record<string, unknown>;
      return typeof text.title === "string" && typeof text.description === "string" && text.description ? [[code, { title: text.title, description: text.description }]] : [];
    }));
  } catch { return {}; }
}

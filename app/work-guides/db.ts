import { env } from "cloudflare:workers";
import { GUIDE_LANGUAGES, type Translation } from "./shared";

export type GuideRow = {
  id: string; account_id: string; application_id: string; artist_name: string;
  pending_title: string | null; pending_description: string | null; pending_image_key: string | null;
  published_title: string | null; published_description: string | null; published_image_key: string | null;
  translations_json: string; submitted_at: string | null; published_at: string | null;
  pending_revision: number; created_at: string;
};

// artwork_guides 테이블 스키마는 migrations/0001_init.sql에 있습니다.

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

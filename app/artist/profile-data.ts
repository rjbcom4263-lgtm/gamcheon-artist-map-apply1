import { MAX_EXPERIENCES, REQUIRED_WORK_COUNT, cleanText } from "../lib/application.ts";
import { sanitizeStudioHours } from "../lib/studio-hours.ts";

export type EditableWork = { id?: string; title?: string; status?: string; description?: string };
export type ArtistExperience = { id: string; title: string; status: "운영 중" | "준비 중"; description: string };
export type ProfileInput = { artistName?: string; categories?: unknown[]; values?: Record<string, unknown>; works?: EditableWork[]; experiences?: unknown[]; studioHours?: unknown };

export const PROFILE_TEXT_LIMITS: Record<string, number> = {
  tagline: 200, bio: 4000, studioName: 150, address: 300, locationPrivacy: 30,
  visitType: 80, hours: 500, experience: 40, experienceDesc: 1000,
  instagram: 500, website: 500, shopUrl: 500,
};

export function sanitizeExperiences(value: unknown): ArtistExperience[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_EXPERIENCES).map((raw) => {
    const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    return { id: cleanText(item.id, 80), title: cleanText(item.title, 100), status: item.status === "준비 중" ? "준비 중" : "운영 중", description: cleanText(item.description, 500) };
  });
}

/** 받은 체험 목록이 규칙에 어긋나는지 봅니다. 값이 없으면 고치지 않는다는 뜻이라 괜찮습니다. */
export function experiencesInvalid(raw: unknown, cleaned: ArtistExperience[]) {
  return raw !== undefined && (!Array.isArray(raw) || raw.length > MAX_EXPERIENCES || cleaned.some((experience) => !experience.title));
}

export function sanitizeCategories(value: unknown) {
  return Array.isArray(value) ? value.slice(0, 12).map((item) => cleanText(item, 30)).filter(Boolean) : [];
}

export function sanitizeWorks(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, REQUIRED_WORK_COUNT).map((work: EditableWork | null) => ({
    id: cleanText(work?.id, 80), title: cleanText(work?.title, 150), status: cleanText(work?.status, 40), description: cleanText(work?.description, 1200),
  }));
}

export function sanitizeArtistProfile(input: ProfileInput) {
  const artistName = cleanText(input.artistName, 100);
  const categories = sanitizeCategories(input.categories);
  const values = Object.fromEntries(Object.entries(PROFILE_TEXT_LIMITS).map(([key, max]) => [key, cleanText(input.values?.[key], max)]));
  const works = sanitizeWorks(input.works);
  const experiences = input.experiences === undefined ? undefined : sanitizeExperiences(input.experiences);
  if (!artistName || !values.tagline || !categories.length) return { error: "작가명, 분야, 한 줄 소개를 입력해주세요." } as const;
  if (!works.length || works.some((work) => !work.title)) return { error: "모든 작품의 이름을 입력해주세요." } as const;
  if (experiences && experiencesInvalid(input.experiences, experiences)) return { error: "체험 프로그램 이름을 확인해주세요." } as const;
  // undefined: 그대로 둠, null: 요일별 시간 지우고 글자 운영시간만 사용
  const studioHours = input.studioHours === undefined ? undefined : input.studioHours === null ? null : sanitizeStudioHours(input.studioHours);
  if (studioHours && "error" in studioHours) return { error: studioHours.error } as const;
  return { artistName, categories, values, works, experiences, studioHours };
}

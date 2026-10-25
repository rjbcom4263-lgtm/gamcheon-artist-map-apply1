export type EditableWork = { id?: string; title?: string; status?: string; description?: string };
export type ArtistExperience = { id: string; title: string; status: "운영 중" | "준비 중"; description: string };
export type ProfileInput = { artistName?: string; categories?: unknown[]; values?: Record<string, unknown>; works?: EditableWork[]; experiences?: unknown[] };

const fields: Record<string, number> = {
  tagline: 200, bio: 4000, studioName: 150, address: 300, locationPrivacy: 30,
  visitType: 80, hours: 500, experience: 40, experienceDesc: 1000,
  instagram: 500, website: 500, shopUrl: 500,
};

function text(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

export function sanitizeExperiences(value: unknown): ArtistExperience[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map((raw) => {
    const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    return { id: text(item.id, 80), title: text(item.title, 100), status: item.status === "준비 중" ? "준비 중" : "운영 중", description: text(item.description, 500) };
  });
}

export function sanitizeArtistProfile(input: ProfileInput) {
  const artistName = text(input.artistName, 100);
  const categories = Array.isArray(input.categories) ? input.categories.slice(0, 12).map((value) => text(value, 30)).filter(Boolean) : [];
  const values = Object.fromEntries(Object.entries(fields).map(([key, max]) => [key, text(input.values?.[key], max)]));
  const works = Array.isArray(input.works) ? input.works.slice(0, 5).map((work) => ({
    id: text(work.id, 80), title: text(work.title, 150), status: text(work.status, 40), description: text(work.description, 1200),
  })) : [];
  const experiences = input.experiences === undefined ? undefined : sanitizeExperiences(input.experiences);
  if (!artistName || !values.tagline || !categories.length) return { error: "작가명, 분야, 한 줄 소개를 입력해주세요." } as const;
  if (!works.length || works.some((work) => !work.title)) return { error: "모든 작품의 이름을 입력해주세요." } as const;
  if (input.experiences !== undefined && (!Array.isArray(input.experiences) || input.experiences.length > 20 || experiences?.some((experience) => !experience.title))) return { error: "체험 프로그램 이름을 확인해주세요." } as const;
  return { artistName, categories, values, works, experiences };
}

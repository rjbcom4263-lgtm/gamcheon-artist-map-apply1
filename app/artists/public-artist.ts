export type PublicArtistRow = { id: string; artist_name: string; payload_json: string; image_keys_json: string };
export const SAVED_ARTISTS_KEY = "gamcheon-saved-artists";
export type PublicWork = { title: string; description: string; status: string; image: string };
export type PublicArtist = {
  id: string; name: string; categories: string[]; tagline: string; bio: string; studio: string; address: string;
  hours: string; visitType: string; experience: string; experienceDesc: string; profile: string;
  instagram: string; website: string; shopUrl: string; works: PublicWork[];
};

type Work = { title?: unknown; description?: unknown; status?: unknown };
type Payload = { values?: Record<string, unknown>; categories?: unknown[]; works?: Work[] };
type ImageRecord = { type?: string; workIndex?: number; key?: string };

function parse<T>(value: string, fallback: T): T { try { return JSON.parse(value) as T; } catch { return fallback; } }
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function publicUrl(value: unknown) { const url = text(value); return /^https?:\/\//i.test(url) ? url : ""; }
function imageUrl(key?: string) { return key ? `/api/artists/images?key=${encodeURIComponent(key)}` : ""; }

export function artistRowToProfile(row: PublicArtistRow, includeHidden = false): PublicArtist | null {
  const payload = parse<Payload>(row.payload_json, {});
  const values = payload.values || {};
  if (!includeHidden && values.mapPublished === false) return null;
  const images = parse<ImageRecord[]>(row.image_keys_json, []);
  const exactAddress = text(values.locationPrivacy) === "exact" ? text(values.address || values.studioAddress) : "";
  const works = Array.isArray(payload.works) ? payload.works : [];

  return {
    id: row.id,
    name: row.artist_name,
    categories: (payload.categories || []).filter((value): value is string => typeof value === "string" && !!value.trim()).map((value) => value.trim()),
    tagline: text(values.tagline) || "감천에서 이어가는 작업과 이야기를 소개합니다.",
    bio: text(values.bio) || "작가의 작업 세계와 감천에서의 이야기를 준비하고 있습니다.",
    studio: text(values.studioName) || "감천 작업실",
    address: exactAddress || "감천문화마을 일대",
    hours: text(values.hours) || "방문 전 운영시간을 확인해주세요.",
    visitType: text(values.visitType) || "방문 전 문의",
    experience: text(values.experience),
    experienceDesc: text(values.experienceDesc),
    profile: imageUrl(images.find((image) => image.type === "profile" && image.key)?.key) || "/assets/clone/hero-artist-studio.png",
    instagram: publicUrl(values.instagram),
    website: publicUrl(values.website),
    shopUrl: publicUrl(values.shopUrl),
    works: works.map((work, index) => ({
      title: text(work.title) || `대표 작품 ${index + 1}`,
      description: text(work.description) || "작품에 대한 이야기를 준비하고 있습니다.",
      status: text(work.status),
      image: imageUrl(images.find((image) => image.type === "work" && image.workIndex === index && image.key)?.key) || (index % 2 ? "/assets/clone/artist-goods.png" : "/assets/clone/hero-artist-studio.png"),
    })),
  };
}

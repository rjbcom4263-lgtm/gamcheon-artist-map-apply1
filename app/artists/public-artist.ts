import { sanitizeExperiences, type ArtistExperience } from "../artist/profile-data";
import { publicAddress } from "../lib/location-privacy";
import { parse } from "../lib/json";
import { galleryRecords } from "../lib/studio-gallery";
import { formatWeekly, readStudioHours, studioStatus, type StudioHours, type StudioStatus } from "../lib/studio-hours";

export type PublicArtistRow = { id: string; artist_name: string; payload_json: string; image_keys_json: string; created_at?: string };
export const SAVED_ARTISTS_KEY = "gamcheon-saved-artists";
export type PublicWork = { title: string; description: string; status: string; image: string };
export type PublicPhoto = { key: string; image: string; caption: string };
/** 큰길에서 작업실 입구까지의 진입 지점 사진. image_keys_json의 type "entrance" 항목에서 읽습니다. */
export type EntrancePhoto = { image: string; caption: string };
/** 계단·경사·출입 제한 같은 이동 조건. payload values의 access* 항목(선택)에서 읽습니다. */
export type AccessInfo = { stairs: string; slope: string; restriction: string; note: string };
export type PublicArtist = {
  id: string; name: string; categories: string[]; tagline: string; bio: string; studio: string; address: string;
  hours: string; visitType: string; experience: string; experienceDesc: string; experiences: ArtistExperience[]; profile: string;
  instagram: string; website: string; shopUrl: string; works: PublicWork[];
  studioHours?: StudioHours; status?: StudioStatus; gallery: PublicPhoto[];
  entrances: EntrancePhoto[]; access: AccessInfo;
  /** 신청서 등록 시각(D1 CURRENT_TIMESTAMP, UTC). */
  registeredAt: string;
  /** 운영자가 현장에서 정보를 확인한 날짜(values.verifiedAt, 선택). 없으면 빈 문자열. */
  verifiedAt: string;
};

type Work = { title?: unknown; description?: unknown; status?: unknown };
type Payload = { values?: Record<string, unknown>; categories?: unknown[]; works?: Work[]; experiences?: unknown[]; studioHours?: unknown };
type ImageRecord = { type?: string; workIndex?: number; key?: string; caption?: unknown };

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function publicUrl(value: unknown) { const url = text(value); return /^https?:\/\//i.test(url) ? url : ""; }
function imageUrl(key?: string) { return key ? `/api/artists/images?key=${encodeURIComponent(key)}` : ""; }

export function artistRowToProfile(row: PublicArtistRow): PublicArtist {
  const payload = parse<Payload>(row.payload_json, {});
  const values = payload.values || {};
  const images = parse<ImageRecord[]>(row.image_keys_json, []);
  const works = Array.isArray(payload.works) ? payload.works : [];
  const experiences = payload.experiences === undefined && text(values.experience) && text(values.experience) !== "없음"
    ? [{ id: "legacy", title: "체험 프로그램", status: text(values.experience) === "준비 중" ? "준비 중" : "운영 중", description: text(values.experienceDesc) } as ArtistExperience]
    : sanitizeExperiences(payload.experiences).filter((experience) => experience.title);
  const entrances = images.filter((image) => image.type === "entrance" && image.key).slice(0, 6)
    .map((image, index) => ({ image: imageUrl(image.key), caption: text(image.caption) || `진입 지점 ${index + 1}` }));

  const studioHours = readStudioHours(payload.studioHours);
  const visitType = text(values.visitType) || "방문 전 문의";

  return {
    id: row.id,
    name: row.artist_name,
    categories: (payload.categories || []).filter((value): value is string => typeof value === "string" && !!value.trim()).map((value) => value.trim()),
    tagline: text(values.tagline) || "감천에서 이어가는 작업과 이야기를 소개합니다.",
    bio: text(values.bio) || "작가의 작업 세계와 감천에서의 이야기를 준비하고 있습니다.",
    studio: text(values.studioName) || "감천 작업실",
    address: publicAddress(values),
    hours: studioHours ? formatWeekly(studioHours) : text(values.hours) || "방문 전 운영시간을 확인해주세요.",
    visitType,
    ...(studioHours ? { studioHours, status: studioStatus(studioHours, visitType) } : {}),
    gallery: galleryRecords(images).map((photo) => ({ key: photo.key, image: imageUrl(photo.key), caption: text(photo.caption) })),
    experience: text(values.experience),
    experienceDesc: text(values.experienceDesc),
    experiences,
    profile: imageUrl(images.find((image) => image.type === "profile" && image.key)?.key) || "/assets/home/hero-artist-studio.webp",
    instagram: publicUrl(values.instagram),
    website: publicUrl(values.website),
    shopUrl: publicUrl(values.shopUrl),
    works: works.map((work, index) => ({
      title: text(work.title) || `대표 작품 ${index + 1}`,
      description: text(work.description) || "작품에 대한 이야기를 준비하고 있습니다.",
      status: text(work.status),
      image: imageUrl(images.find((image) => image.type === "work" && image.workIndex === index && image.key)?.key) || (index % 2 ? "/assets/home/artist-goods.webp" : "/assets/home/hero-artist-studio.webp"),
    })),
    entrances,
    access: { stairs: text(values.accessStairs), slope: text(values.accessSlope), restriction: text(values.accessRestriction), note: text(values.accessNote) },
    registeredAt: text(row.created_at),
    verifiedAt: text(values.verifiedAt),
  };
}

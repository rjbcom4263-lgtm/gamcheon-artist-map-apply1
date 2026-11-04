// 작업실 사진 갤러리. 사진은 신청서 image_keys_json에 type "gallery"로, 보여줄 순서대로 저장합니다.
// 공개 이미지 API(/api/artists/images)는 이 목록에 있는 키만 내보내므로 따로 바꿀 곳이 없습니다.

export const MAX_GALLERY_PHOTOS = 12;
export const MAX_GALLERY_CAPTION = 80;
export const GALLERY_UPLOAD_FIELD = /^galleryNew(\d{1,2})$/;

export type GalleryRecord = { type: "gallery"; key: string; name?: string; contentType?: string; caption?: string };
/** 저장 요청의 한 줄: 이미 있는 사진(key) 또는 이번에 올리는 파일(upload = 폼 필드 이름). */
export type GalleryPlanItem = { key?: string; upload?: string; caption: string };
type ImageLike = { type?: string; key?: string };

export function galleryRecords<T extends ImageLike>(images: T[]) {
  return images.filter((image): image is T & GalleryRecord => image.type === "gallery" && typeof image.key === "string" && !!image.key);
}

/** 화면에서 보낸 순서·설명 목록을 검사합니다. 남의 키나 중복, 개수 초과는 막습니다. */
export function planGallery(input: unknown, existing: ImageLike[]): { items: GalleryPlanItem[]; removed: string[] } | { error: string } {
  if (!Array.isArray(input)) return { error: "작업실 사진 정보를 확인해주세요." };
  if (input.length > MAX_GALLERY_PHOTOS) return { error: `작업실 사진은 ${MAX_GALLERY_PHOTOS}장까지 올릴 수 있습니다.` };
  const current = new Set(galleryRecords(existing).map((image) => image.key));
  const seen = new Set<string>();
  const items: GalleryPlanItem[] = [];
  for (const raw of input) {
    const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const caption = typeof item.caption === "string" ? item.caption.trim().slice(0, MAX_GALLERY_CAPTION) : "";
    const key = typeof item.key === "string" ? item.key : "";
    const upload = typeof item.upload === "string" ? item.upload : "";
    const id = key ? `key:${key}` : `upload:${upload}`;
    if (key ? !current.has(key) : !GALLERY_UPLOAD_FIELD.test(upload)) return { error: "작업실 사진 정보를 확인해주세요." };
    if (seen.has(id)) return { error: "같은 사진이 두 번 들어 있습니다." };
    seen.add(id);
    items.push(key ? { key, caption } : { upload, caption });
  }
  const kept = new Set(items.flatMap((item) => item.key ? [item.key] : []));
  return { items, removed: [...current].filter((key) => !kept.has(key)) };
}

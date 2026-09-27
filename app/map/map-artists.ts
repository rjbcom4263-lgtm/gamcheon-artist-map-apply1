export type ArtistRow = { id: string; artist_name: string; payload_json: string; image_keys_json: string };
export type ArtistPlace = {
  id: string;
  name: string;
  type: string;
  categories: string[];
  studio: string;
  address: string;
  hours: string;
  visitType: string;
  image: string;
  detailHref: string;
  position?: { x: number; y: number };
  geoPosition?: { longitude: number; latitude: number };
};

type Payload = { values?: Record<string, unknown>; categories?: unknown[] };
type ImageRecord = { type?: string; workIndex?: number; key?: string };

function parse<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function artistRowsToPlaces(rows: ArtistRow[]): ArtistPlace[] {
  return rows.flatMap((row, index) => {
    const payload = parse<Payload>(row.payload_json, {});
    const values = payload.values || {};
    if (values.mapPublished === false) return [];
    const categories = (payload.categories || []).filter((value): value is string => typeof value === "string" && !!value.trim()).map((value) => value.trim());
    const images = parse<ImageRecord[]>(row.image_keys_json, []);
    const imageKey = images.find((image) => image.type === "profile" && image.key)?.key || images.find((image) => image.type === "work" && image.key)?.key;
    const x = Number(values.mapX);
    const y = Number(values.mapY);
    const position = Number.isFinite(x) && Number.isFinite(y) && x >= 5 && x <= 95 && y >= 12 && y <= 78 ? { x, y } : undefined;
    const longitude = Number(values.mapLongitude);
    const latitude = Number(values.mapLatitude);
    const geoPosition = Number.isFinite(longitude) && Number.isFinite(latitude)
      && longitude >= 128.9998 && longitude <= 129.0174 && latitude >= 35.0867 && latitude <= 35.1023
      ? { longitude, latitude } : undefined;
    const exactAddress = text(values.locationPrivacy) === "exact" ? text(values.address || values.studioAddress) : "";

    return [{
      id: row.id,
      name: row.artist_name,
      type: categories.length ? `${categories[0]} 작가` : "감천 참여 작가",
      categories,
      studio: text(values.studioName) || "작업실 정보 준비 중",
      address: exactAddress || "감천문화마을 일대",
      hours: text(values.hours) || "운영시간 확인 필요",
      visitType: text(values.visitType) || "방문 전 문의",
      image: imageKey ? `/api/artists/images?key=${encodeURIComponent(imageKey)}` : index % 2 ? "/assets/clone/artist-goods.png" : "/assets/clone/hero-artist-studio.png",
      detailHref: `/artists/${encodeURIComponent(row.id)}`,
      ...(position ? { position } : {}),
      ...(geoPosition ? { geoPosition } : {}),
    }];
  });
}

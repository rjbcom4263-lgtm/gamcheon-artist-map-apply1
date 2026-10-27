import { isLegacyMapPosition, isWithinGamcheon } from "../lib/geo";
import { parse } from "../lib/json";

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
    const position = isLegacyMapPosition(x, y) ? { x, y } : undefined;
    const longitude = Number(values.mapLongitude);
    const latitude = Number(values.mapLatitude);
    const geoPosition = isWithinGamcheon(longitude, latitude) ? { longitude, latitude } : undefined;
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
      image: imageKey ? `/api/artists/images?key=${encodeURIComponent(imageKey)}` : index % 2 ? "/assets/home/artist-goods.png" : "/assets/home/hero-artist-studio.png",
      detailHref: `/artists/${encodeURIComponent(row.id)}`,
      ...(position ? { position } : {}),
      ...(geoPosition ? { geoPosition } : {}),
    }];
  });
}

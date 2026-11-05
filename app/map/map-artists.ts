import { isLegacyMapPosition, isWithinGamcheon } from "../lib/geo.ts";
import { parse } from "../lib/json.ts";
import { publicMapPosition, type LocationMode } from "../lib/location-privacy.ts";
import { placeStatusFields, readStudioHours, type StudioHours, type StudioState } from "../lib/studio-hours.ts";

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
  status?: { state: StudioState; label: string };
  /** 지도를 오래 열어 둘 때 브라우저에서 상태를 다시 계산하는 데 씁니다. */
  studioHours?: StudioHours;
  image: string;
  detailHref: string;
  /** 작가가 고른 위치 공개 범위를 적용한 결과입니다. 정확한 좌표는 exact일 때만 나갑니다. */
  locationMode: LocationMode;
  position?: { x: number; y: number };
  geoPosition?: { longitude: number; latitude: number };
};

type Payload = { values?: Record<string, unknown>; categories?: unknown[]; studioHours?: unknown };
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
    const privacy = text(values.locationPrivacy);
    const x = Number(values.mapX);
    const y = Number(values.mapY);
    const position = privacy === "exact" && isLegacyMapPosition(x, y) ? { x, y } : undefined;
    const longitude = Number(values.mapLongitude);
    const latitude = Number(values.mapLatitude);
    const location = isWithinGamcheon(longitude, latitude) ? publicMapPosition(privacy, longitude, latitude) : { mode: "unplaced" as const };
    const exactAddress = privacy === "exact" ? text(values.address || values.studioAddress) : "";
    const visitType = text(values.visitType) || "방문 전 문의";
    const studioHours = readStudioHours(payload.studioHours);
    const live = studioHours ? placeStatusFields(studioHours, visitType) : undefined;

    return [{
      id: row.id,
      name: row.artist_name,
      type: categories.length ? `${categories[0]} 작가` : "감천 참여 작가",
      categories,
      studio: text(values.studioName) || "작업실 정보 준비 중",
      address: exactAddress || "감천문화마을 일대",
      hours: live?.hours || text(values.hours) || "운영시간 확인 필요",
      visitType,
      ...(live ? { studioHours, status: live.status } : {}),
      image: imageKey ? `/api/artists/images?key=${encodeURIComponent(imageKey)}` : index % 2 ? "/assets/home/artist-goods.webp" : "/assets/home/hero-artist-studio.webp",
      detailHref: `/artists/${encodeURIComponent(row.id)}`,
      locationMode: location.mode,
      ...(position ? { position } : {}),
      ...(location.position ? { geoPosition: location.position } : {}),
    }];
  });
}

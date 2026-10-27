/** 감천문화마을 일대 경위도 범위. 지도에 배치할 수 있는 좌표인지 판정할 때 씁니다. */
export const GAMCHEON_BOUNDS = { minLongitude: 128.9998, maxLongitude: 129.0174, minLatitude: 35.0867, maxLatitude: 35.1023 } as const;

export function isWithinGamcheon(longitude: unknown, latitude: unknown): longitude is number {
  return typeof longitude === "number" && typeof latitude === "number"
    && Number.isFinite(longitude) && Number.isFinite(latitude)
    && longitude >= GAMCHEON_BOUNDS.minLongitude && longitude <= GAMCHEON_BOUNDS.maxLongitude
    && latitude >= GAMCHEON_BOUNDS.minLatitude && latitude <= GAMCHEON_BOUNDS.maxLatitude;
}

/** 옛 평면 지도 좌표(백분율 x 5~95, y 12~78)인지 판정합니다. */
export function isLegacyMapPosition(x: unknown, y: unknown): x is number {
  return typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y) && x >= 5 && x <= 95 && y >= 12 && y <= 78;
}

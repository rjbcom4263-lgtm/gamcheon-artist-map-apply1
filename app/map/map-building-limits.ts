// art-map/src/gamcheonBoundary.ts의 GAMCHEON_MAP_BOUNDS와 같은 범위입니다.
// 새 건물 그리기는 골목길 GPS 작업 범위보다 넓은 지도 전체에서 허용됩니다.
export const BUILDING_EDIT_LIMITS = {
  west: 128.9998058,
  south: 35.0867957,
  east: 129.0173734,
  north: 35.1022347,
} as const;

export const insideBuildingEditLimits = (lng: number, lat: number) =>
  lng >= BUILDING_EDIT_LIMITS.west && lng <= BUILDING_EDIT_LIMITS.east
  && lat >= BUILDING_EDIT_LIMITS.south && lat <= BUILDING_EDIT_LIMITS.north;

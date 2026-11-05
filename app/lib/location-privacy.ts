// 작가가 고른 위치 공개 범위를 공개 지도 좌표에 적용합니다. 정확한 좌표는 운영자 화면을 위해 그대로 보관하고,
// 공개로 나가기 전에 서버에서 바꿉니다. 브라우저로 정확한 좌표를 보내지 않으므로 화면에서 숨기는 것과 다릅니다.
export type LocationMode = "exact" | "approximate" | "hidden" | "unplaced";

// 감천(북위 35.1도)에서 약 150m입니다. 같은 칸은 항상 같은 좌표로 나가, 여러 번 봐도 평균으로 원래 위치를 추정할 수 없습니다.
const LONGITUDE_STEP = 0.00165;
const LATITUDE_STEP = 0.00135;

const cellCenter = (value: number, step: number) => Math.round((Math.floor(value / step) + 0.5) * step * 1e6) / 1e6;

/** 공개 지도에 내보낼 좌표. 범위 값이 없거나 알 수 없으면 가장 보수적으로 내보내지 않습니다. */
export function publicMapPosition(privacy: unknown, longitude: number, latitude: number): { mode: LocationMode; position?: { longitude: number; latitude: number } } {
  if (privacy === "exact") return { mode: "exact", position: { longitude, latitude } };
  if (privacy === "nearby") return { mode: "approximate", position: { longitude: cellCenter(longitude, LONGITUDE_STEP), latitude: cellCenter(latitude, LATITUDE_STEP) } };
  return { mode: "hidden" };
}

/** 운영자가 핀을 찍을 때 보는 안내입니다. */
export function locationPrivacyNote(privacy: unknown) {
  if (privacy === "exact") return "정확한 공방 위치 공개: 공개 지도에 찍은 위치 그대로 표시됩니다.";
  if (privacy === "nearby") return "근처 위치만 공개: 공개 지도에는 약 150m 단위의 대략적인 위치로 표시됩니다.";
  if (privacy === "reservation") return "예약 방문객에게만 안내: 공개 지도에 핀이 표시되지 않습니다.";
  return "위치 공개 범위 미지정: 공개 지도에 핀이 표시되지 않습니다.";
}

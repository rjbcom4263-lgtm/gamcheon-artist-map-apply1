// 작가가 고른 위치 공개 범위를 공개 지도 좌표에 적용합니다. 정확한 좌표는 운영자 화면을 위해 그대로 보관하고,
// 공개로 나가기 전에 서버에서 바꿉니다. 브라우저로 정확한 좌표를 보내지 않으므로 화면에서 숨기는 것과 다릅니다.
export type LocationMode = "exact" | "approximate" | "hidden" | "unplaced";

// 감천(북위 35.1도)에서 약 150m입니다. 같은 칸은 항상 같은 좌표로 나가, 여러 번 봐도 평균으로 원래 위치를 추정할 수 없습니다.
const LONGITUDE_STEP = 0.00165;
const LATITUDE_STEP = 0.00135;

const cellCenter = (value: number, step: number) => Math.round((Math.floor(value / step) + 0.5) * step * 1e6) / 1e6;

/** 작가가 고르는 범위와, 공개 지도·소개에 실제로 어떻게 보이는지에 대한 설명입니다. 신청 화면과 프로필 수정이 함께 씁니다. */
export const LOCATION_PRIVACY_CHOICES = [
  { value: "exact", label: "정확한 공방 위치 공개", description: "지도에 찍은 위치 그대로 핀을 표시하고 주소를 공개합니다.", adminNote: "공개 지도에 찍은 위치 그대로 표시됩니다." },
  { value: "nearby", label: "근처 위치만 공개", description: "지도에는 약 150m 단위의 대략적인 위치로 표시하고, 정확한 주소는 숨깁니다.", adminNote: "공개 지도에는 약 150m 단위의 대략적인 위치로 표시됩니다." },
  { value: "reservation", label: "예약 방문객에게만 안내", description: "지도에 핀을 표시하지 않고, 세부 주소는 별도로 안내합니다.", adminNote: "공개 지도에 핀이 표시되지 않습니다." },
] as const;

/** 공개 지도에 내보낼 좌표. 범위 값이 없거나 알 수 없으면 가장 보수적으로 내보내지 않습니다. */
export function publicMapPosition(privacy: unknown, longitude: number, latitude: number): { mode: LocationMode; position?: { longitude: number; latitude: number } } {
  if (privacy === "exact") return { mode: "exact", position: { longitude, latitude } };
  if (privacy === "nearby") return { mode: "approximate", position: { longitude: cellCenter(longitude, LONGITUDE_STEP), latitude: cellCenter(latitude, LATITUDE_STEP) } };
  return { mode: "hidden" };
}

/** 운영자가 핀을 찍을 때 보는 안내입니다. */
export function locationPrivacyNote(privacy: unknown) {
  const choice = LOCATION_PRIVACY_CHOICES.find(({ value }) => value === privacy);
  return choice ? `${choice.label}: ${choice.adminNote}` : "위치 공개 범위 미지정: 공개 지도에 핀이 표시되지 않습니다.";
}

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

/** 방문객에게 보여 줄 주소입니다. 정확한 위치 공개에 동의한 작가만 실제 주소가 나갑니다. */
export function publicAddress(values: Record<string, unknown>) {
  const exact = text(values.locationPrivacy) === "exact" ? text(values.address || values.studioAddress) : "";
  return exact || "감천문화마을 일대";
}

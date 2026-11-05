import { PROFILE_TEXT_LIMITS } from "../artist/profile-data.ts";
import { cleanText } from "../lib/application.ts";

// 신청서로 받는 항목의 허용 목록입니다. 여기에 없는 값은 저장하지 않습니다. 지도 공개 여부, 좌표, 현장 확인일 같은
// 운영자 항목은 공개 화면이 그대로 믿는 값이라, 지원자가 요청을 조작해도 들어가지 않도록 일부러 넣지 않았습니다.
export const APPLICATION_TEXT_LIMITS: Record<string, number> = {
  artistName: 100, phone: 30, email: 150,
  ...PROFILE_TEXT_LIMITS,
  stampInterest: 80, nfcInterest: 80, feedback: 4000,
  consentVersion: 40,
};
const CONSENT_FIELDS = ["consentInfo", "consentImage", "consentPrivacy"];

export type ApplicationValues = Record<string, string | boolean>;

export function sanitizeApplicationValues(input: unknown): ApplicationValues {
  const source = input && typeof input === "object" ? input as Record<string, unknown> : {};
  return {
    ...Object.fromEntries(Object.entries(APPLICATION_TEXT_LIMITS).map(([key, max]) => [key, cleanText(source[key], max)])),
    ...Object.fromEntries(CONSENT_FIELDS.map((key) => [key, source[key] === true])),
  };
}

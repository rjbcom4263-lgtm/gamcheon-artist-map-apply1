// 동의 문구를 바꾸면 버전을 올립니다. 서버는 폼이 보낸 버전이 현재 버전과 같을 때만 가입·신청을 받고,
// 어떤 문구에 동의했는지 계정(account_privacy_consents)과 신청서(payload.values.consentVersion)에 기록합니다.
export const SIGNUP_PRIVACY_VERSION = "2026-10-27-1";
export const APPLY_CONSENT_VERSION = "2026-10-27-1";

/** 신청서 자료 보유기간 안내. 처리방침과 신청 폼이 같은 문구를 씁니다. */
export const APPLICATION_RETENTION_TEXT = "미승인·취소된 신청서는 결과 안내 후 1년이 지나면 삭제합니다. 승인된 작가의 정보·이미지·작품 해설은 작가 소개가 공개되는 동안 보관하고, 공개 철회·삭제 요청을 처리하면 지체 없이 삭제합니다. 법령에 따라 보존해야 하는 기록은 그 기간 동안만 분리 보관합니다.";

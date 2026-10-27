// 계정 가입·비밀번호 규칙. 외부 의존성이 없어 Node 테스트에서 그대로 불러 씁니다.

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

/** 소셜 로그인 계정의 login_id는 `google_<id>` 형식으로 자동 생성됩니다. 일반 가입에서 이 형식을 선점하면
 *  피해자의 첫 소셜 로그인이 UNIQUE 충돌로 실패하므로 막습니다. */
const RESERVED_LOGIN_ID = /^(google|kakao|naver)_/i;

export function isReservedLoginId(loginId: string) {
  return RESERVED_LOGIN_ID.test(loginId.trim());
}

/** 비밀번호 규칙 위반 메시지. 통과하면 null. */
export function passwordProblem(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`;
  if (password.length > MAX_PASSWORD_LENGTH) return `비밀번호는 ${MAX_PASSWORD_LENGTH}자 이하여야 합니다.`;
  if (/^\s|\s$/.test(password)) return "비밀번호 앞뒤에 공백을 넣을 수 없습니다.";
  return null;
}

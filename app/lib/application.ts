// 신청서 관련 상수와 입력 정리 함수. 클라이언트 폼(app/apply)과 API 라우트가 함께 씁니다.

/** 대표 작품 수. 폼 검증과 서버 검증이 같은 값을 보도록 여기서만 정의합니다. */
export const REQUIRED_WORK_COUNT = 5;
export const MAX_EXPERIENCES = 20;
/** 업로드 이미지 한 장의 최대 크기(서버 검증 기준). */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_LABEL = "2MB";

const APPLICATION_ID_PATTERN = /^GA-\d{8}-[A-F0-9]{6}$/;

/** 접수번호 형식(GA-YYYYMMDD-XXXXXX)이면 그 값을, 아니면 빈 문자열을 돌려줍니다. */
export function applicationId(value: unknown) {
  return typeof value === "string" && APPLICATION_ID_PATTERN.test(value) ? value : "";
}

/** 문자열이면 앞뒤 공백을 지우고 max 글자까지만, 아니면 빈 문자열. */
export function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** 업로드 파일의 R2 키용 이름. 원본 이름은 버리고 확장자만 살려 UUID로 만듭니다. */
export function safeFileName(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return `${crypto.randomUUID()}.${ext.slice(0, 8)}`;
}

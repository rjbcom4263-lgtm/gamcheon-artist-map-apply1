// 신청서 관련 상수와 입력 정리 함수. 클라이언트 폼(app/apply)과 API 라우트가 함께 씁니다.

/** 대표 작품 수. 폼 검증과 서버 검증이 같은 값을 보도록 여기서만 정의합니다. */
export const REQUIRED_WORK_COUNT = 5;
export const MAX_EXPERIENCES = 20;
/** 업로드 이미지 한 장의 최대 크기(서버 검증 기준). */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_LABEL = "2MB";
/** 초안 하나에 R2에 쌓일 수 있는 이미지 객체 수 상한. 슬롯 6개(프로필 1 + 작품 5)를 여러 번 다시 고르는 것까지 감안한 값. 제출 시 미참조 객체는 지웁니다. */
export const MAX_DRAFT_IMAGE_OBJECTS = 30;

type ListableBucket = { list(options: { prefix: string; cursor?: string; limit?: number }): Promise<{ objects: Array<{ key: string }>; truncated: boolean; cursor?: string }> };

/** 신청서 접두어(applications/{id}/) 아래의 R2 객체 키를 모두 나열합니다. */
export async function listApplicationImageKeys(bucket: ListableBucket, applicationId: string) {
  const prefix = `applications/${applicationId}/`;
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, cursor, limit: 1000 });
    keys.push(...page.objects.map((object) => object.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return keys;
}

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

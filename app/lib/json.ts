/** JSON 문자열을 안전하게 파싱합니다. 깨진 값이면 fallback을 돌려줍니다. */
export function parse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

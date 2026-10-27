// API 라우트 공용 응답·쿠키 헬퍼.

const COOKIE_FLAGS = "Path=/; HttpOnly; Secure; SameSite=Lax";

/** Set-Cookie 값. maxAge가 0이면 삭제용입니다. */
export function cookie(name: string, value: string, maxAgeSeconds: number) {
  return `${name}=${value}; ${COOKIE_FLAGS}; Max-Age=${maxAgeSeconds}`;
}
export function clearCookie(name: string) {
  return cookie(name, "", 0);
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
export function forbidden(message = "권한이 없습니다.") {
  return jsonError(message, 403);
}
export function badRequest(message: string) {
  return jsonError(message, 400);
}

/** 303 리다이렉트. 쿠키 여러 개를 함께 실을 수 있습니다. */
export function redirectWithCookies(location: string, cookies: string[], status = 303) {
  const headers = new Headers({ location });
  for (const value of cookies) headers.append("set-cookie", value);
  return new Response(null, { status, headers });
}

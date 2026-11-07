import { cookie } from "../lib/http.ts";
import type { SessionUser } from "./admin-auth";
import { bytesToBase64Url } from "./password-hash.ts";

// 세션 토큰을 만들고 서명합니다. 다른 의존성이 없어 처리 함수와 Node 테스트에서 그대로 씁니다.
export const SESSION_COOKIE = { name: "gamcheon_session", maxAge: 60 * 60 * 8 };

// 서명 키는 요청마다 다시 만들지 않고 isolate 안에서 한 번만 import합니다(시크릿이 바뀌면 새 isolate에서 다시 읽힘).
let signingKey: Promise<CryptoKey> | null = null;
function getSigningKey() {
  signingKey ??= crypto.subtle.importKey("raw", new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET || ""), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return signingKey;
}
export async function signSessionPayload(value: string) {
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", await getSigningKey(), new TextEncoder().encode(value))));
}

export async function createSession(user: SessionUser) {
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ ...user, expires: Math.floor(Date.now() / 1000) + SESSION_COOKIE.maxAge })));
  return `${payload}.${await signSessionPayload(payload)}`;
}

/** 세션 토큰을 담은 Set-Cookie 값입니다. */
export function sessionCookie(token: string) {
  return cookie(SESSION_COOKIE.name, token, SESSION_COOKIE.maxAge);
}

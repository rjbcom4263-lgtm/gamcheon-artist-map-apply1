import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { LEGACY_ADMIN_ID } from "./credentials";
import { bytesToBase64Url, safeEqual } from "./password-hash";
import { SESSION_COOKIE } from "./session-cookie";

export { generateTemporaryPassword, hashPassword, safeEqual, sha256Hex, verifyPassword } from "./password-hash";

const COOKIE_NAME = SESSION_COOKIE.name;
const SESSION_SECONDS = SESSION_COOKIE.maxAge;
const ROLES = new Set(["admin", "artist"]);

export type AccountRole = "admin" | "artist";
/** 세션 토큰에 들어가는 내용. sessionVersion은 accounts.session_version과 같아야 유효합니다. */
export type SessionUser = { accountId: string; loginId: string; role: AccountRole; displayName: string; sessionVersion: number };

function textToBase64Url(value: string) { return bytesToBase64Url(new TextEncoder().encode(value)); }
function base64UrlToText(value: string) {
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
    return new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)));
  } catch { return ""; }
}
// 세션 서명 키는 요청마다 다시 만들지 않고 isolate 안에서 한 번만 import합니다(시크릿이 바뀌면 새 isolate에서 다시 읽힘).
let signingKey: Promise<CryptoKey> | null = null;
function getSigningKey() {
  signingKey ??= crypto.subtle.importKey("raw", new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET || ""), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return signingKey;
}
async function sign(value: string) {
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", await getSigningKey(), new TextEncoder().encode(value))));
}

/** 계정의 세션 버전을 올려 지금까지 발급된 세션을 모두 끊습니다. 새 버전을 돌려줍니다(계정이 없으면 null). */
export async function invalidateSessions(accountId: string) {
  const row = await env.DB.prepare("UPDATE accounts SET session_version = session_version + 1 WHERE id = ? RETURNING session_version")
    .bind(accountId).first<{ session_version: number }>();
  return row?.session_version ?? null;
}

export async function createSession(user: SessionUser) {
  const payload = textToBase64Url(JSON.stringify({ ...user, expires: Math.floor(Date.now() / 1000) + SESSION_SECONDS }));
  return `${payload}.${await sign(payload)}`;
}

export async function requireSession(role?: AccountRole): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value || "";
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !process.env.ADMIN_SESSION_SECRET || !safeEqual(await sign(payload), signature)) return null;
  let data: SessionUser & { expires?: number };
  try { data = JSON.parse(base64UrlToText(payload)); } catch { return null; }
  if (!data.accountId || !data.loginId || !ROLES.has(data.role) || !data.expires || data.expires < Date.now() / 1000) return null;
  if (!Number.isInteger(data.sessionVersion)) return null;
  if (role && data.role !== role) return null;

  // 서명이 맞아도 DB 상태를 한 번 더 봅니다: 정지·삭제됐거나, 비밀번호 변경 등으로 세션 버전이 올라갔거나, 역할이 바뀐 세션은 거부합니다.
  if (data.accountId !== LEGACY_ADMIN_ID) {
    const account = await env.DB.prepare("SELECT role, status, session_version FROM accounts WHERE id = ?")
      .bind(data.accountId).first<{ role: string; status: string; session_version: number }>();
    if (!account || account.status === "suspended" || account.status === "deleted") return null;
    if (account.session_version !== data.sessionVersion || account.role !== data.role) return null;
  }
  return { accountId: data.accountId, loginId: data.loginId, role: data.role, displayName: data.displayName || data.loginId, sessionVersion: data.sessionVersion };
}
export async function requireAdmin() {
  return requireSession("admin");
}
export async function requireArtist() {
  return requireSession("artist");
}
export const adminCookie = SESSION_COOKIE;

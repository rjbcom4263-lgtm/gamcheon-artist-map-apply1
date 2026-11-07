import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { LEGACY_ADMIN_ID, ROLES } from "./credentials";
import { safeEqual } from "./password-hash";
import { SESSION_COOKIE, signSessionPayload } from "./session-token";


export type AccountRole = "admin" | "artist";
/** 세션 토큰에 들어가는 내용. sessionVersion은 accounts.session_version과 같아야 유효합니다. */
export type SessionUser = { accountId: string; loginId: string; role: AccountRole; displayName: string; sessionVersion: number };

function base64UrlToText(value: string) {
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
    return new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)));
  } catch { return ""; }
}
/** 계정의 세션 버전을 올려 지금까지 발급된 세션을 모두 끊습니다. 새 버전을 돌려줍니다(계정이 없으면 null). */
export async function invalidateSessions(accountId: string) {
  const row = await env.DB.prepare("UPDATE accounts SET session_version = session_version + 1 WHERE id = ? RETURNING session_version")
    .bind(accountId).first<{ session_version: number }>();
  return row?.session_version ?? null;
}

export async function requireSession(role?: AccountRole): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE.name)?.value || "";
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !process.env.ADMIN_SESSION_SECRET || !safeEqual(await signSessionPayload(payload), signature)) return null;
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

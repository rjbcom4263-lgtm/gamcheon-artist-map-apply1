import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { SIGNUP_PRIVACY_VERSION } from "../signup/privacy-consent";
import { bytesToBase64Url, hashPassword, safeEqual, sha256Hex, verifyPassword } from "./password-hash";
import { cleanText } from "../lib/application";
import { isReservedLoginId, passwordProblem } from "../lib/account-rules";

export { generateTemporaryPassword, hashPassword, safeEqual, sha256Hex, verifyPassword } from "./password-hash";

const COOKIE_NAME = "gamcheon_session";
const SESSION_SECONDS = 60 * 60 * 8;
const ROLES = new Set(["admin", "artist"]);
/** 환경변수(ADMIN_USERNAME/ADMIN_PASSWORD_HASH)로 로그인한 초기 관리자. DB에 활성 관리자 계정이 생기면 이 경로는 닫힙니다. */
const LEGACY_ADMIN_ID = "legacy-admin";

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

async function verifyAdminCredentials(username: string, password: string) {
  return safeEqual(username, process.env.ADMIN_USERNAME || "") && safeEqual(await sha256Hex(password), process.env.ADMIN_PASSWORD_HASH || "");
}
async function hasActiveAdminAccount() {
  const row = await env.DB.prepare("SELECT 1 AS ok FROM accounts WHERE role = 'admin' AND status = 'active' LIMIT 1").first<{ ok: number }>();
  return !!row;
}

export async function createArtistAccount(input: { loginId?: string; password?: string; displayName?: string; phone?: string; email?: string; consentRequired?: unknown; consentEmail?: unknown; privacyVersion?: unknown }) {
  if (input.consentRequired !== true || input.privacyVersion !== SIGNUP_PRIVACY_VERSION) return { error: "현재 개인정보 안내를 확인하고 필수 항목에 동의해 주세요.", status: 400 };
  const loginId = cleanText(input.loginId, 150);
  const password = typeof input.password === "string" ? input.password : "";
  const displayName = cleanText(input.displayName, 100);
  const phone = cleanText(input.phone, 30);
  const email = cleanText(input.email, 150);
  if (!loginId || !password || !displayName || !phone) return { error: "필수 정보를 모두 입력해주세요.", status: 400 };
  if (isReservedLoginId(loginId)) return { error: "google_, kakao_, naver_로 시작하는 아이디는 소셜 로그인용이라 사용할 수 없습니다.", status: 400 };
  const problem = passwordProblem(password);
  if (problem) return { error: problem, status: 400 };
  if (email && input.consentEmail !== true) return { error: "이메일 수집·이용에 동의하거나 이메일을 비워 주세요.", status: 400 };
  const id = `ACC-${crypto.randomUUID()}`;
  const acceptedAt = new Date().toISOString();
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO accounts (id, login_id, password_hash, role, status, display_name, phone, email) VALUES (?, ?, ?, 'artist', 'pending', ?, ?, ?)")
        .bind(id, loginId, await hashPassword(password), displayName, phone, email),
      env.DB.prepare("INSERT INTO account_privacy_consents (account_id, version, required_accepted_at, email_accepted_at) VALUES (?, ?, ?, ?)")
        .bind(id, SIGNUP_PRIVACY_VERSION, acceptedAt, input.consentEmail === true ? acceptedAt : null),
    ]);
    return { account: { id, loginId, role: "artist" as AccountRole, status: "pending", displayName, sessionVersion: 1 } };
  } catch (error) {
    if (String(error).includes("UNIQUE constraint failed: accounts.login_id")) return { error: "이미 사용 중인 아이디입니다.", status: 409 };
    return { error: "회원가입을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.", status: 500 };
  }
}

export async function verifyCredentials(loginId: string, password: string): Promise<SessionUser | null> {
  const account = await env.DB.prepare("SELECT id, login_id, password_hash, role, status, display_name, session_version FROM accounts WHERE login_id = ?")
    .bind(loginId).first<{ id: string; login_id: string; password_hash: string; role: string; status: string; display_name: string; session_version: number }>();
  if (account && account.status !== "deleted" && account.status !== "suspended" && ROLES.has(account.role)) {
    const verified = await verifyPassword(password, account.password_hash);
    if (verified.ok) {
      // 옛 SHA-256 해시로 저장된 계정은 로그인에 성공한 이 시점에 새 형식으로 바꿔 둡니다.
      if (verified.needsRehash) {
        await env.DB.prepare("UPDATE accounts SET password_hash = ?, last_login_at = CURRENT_TIMESTAMP WHERE id = ? AND password_hash = ?")
          .bind(await hashPassword(password), account.id, account.password_hash).run();
      } else {
        await env.DB.prepare("UPDATE accounts SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?").bind(account.id).run();
      }
      return { accountId: account.id, loginId: account.login_id, role: account.role as AccountRole, displayName: account.display_name || account.login_id, sessionVersion: account.session_version };
    }
  }
  // 환경변수 관리자는 DB에 활성 관리자 계정이 하나도 없을 때만 받습니다. 계정을 승격한 뒤에는 ADMIN_* 비밀값을 지워도 됩니다.
  if (!account && !(await hasActiveAdminAccount()) && await verifyAdminCredentials(loginId, password)) {
    return { accountId: LEGACY_ADMIN_ID, loginId, role: "admin", displayName: loginId, sessionVersion: 0 };
  }
  return null;
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
export const adminCookie = { name: COOKIE_NAME, maxAge: SESSION_SECONDS };

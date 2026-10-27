import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { SIGNUP_PRIVACY_VERSION } from "../signup/privacy-consent";
import { bytesToBase64Url, hashPassword, safeEqual, sha256Hex, verifyPassword } from "./password-hash";
import { cleanText } from "../lib/application";

export { generateTemporaryPassword, hashPassword, safeEqual, sha256Hex, verifyPassword } from "./password-hash";

const COOKIE_NAME = "gamcheon_session";
const SESSION_SECONDS = 60 * 60 * 8;
const ROLES = new Set(["admin", "artist"]);

export type AccountRole = "admin" | "artist";
export type SessionUser = { accountId: string; loginId: string; role: AccountRole; displayName: string };

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
export async function verifyAdminCredentials(username: string, password: string) {
  return safeEqual(username, process.env.ADMIN_USERNAME || "") && safeEqual(await sha256Hex(password), process.env.ADMIN_PASSWORD_HASH || "");
}
export async function createArtistAccount(input: { loginId?: string; password?: string; displayName?: string; phone?: string; email?: string; consentRequired?: unknown; consentEmail?: unknown; privacyVersion?: unknown }) {
  if (input.consentRequired !== true || input.privacyVersion !== SIGNUP_PRIVACY_VERSION) return { error: "현재 개인정보 안내를 확인하고 필수 항목에 동의해 주세요.", status: 400 };
  const loginId = cleanText(input.loginId, 150);
  const password = typeof input.password === "string" ? input.password : "";
  const displayName = cleanText(input.displayName, 100);
  const phone = cleanText(input.phone, 30);
  const email = cleanText(input.email, 150);
  if (!loginId || !password || !displayName || !phone) return { error: "필수 정보를 모두 입력해주세요.", status: 400 };
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
    return { account: { id, loginId, role: "artist" as AccountRole, status: "pending", displayName } };
  } catch (error) {
    if (String(error).includes("UNIQUE constraint failed: accounts.login_id")) return { error: "이미 사용 중인 아이디입니다.", status: 409 };
    return { error: "회원가입을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.", status: 500 };
  }
}
export async function verifyCredentials(loginId: string, password: string) {
  const account = await env.DB.prepare("SELECT id, login_id, password_hash, role, status, display_name FROM accounts WHERE login_id = ?")
    .bind(loginId).first<{ id: string; login_id: string; password_hash: string; role: string; status: string; display_name: string }>();
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
      return { accountId: account.id, loginId: account.login_id, role: account.role as AccountRole, displayName: account.display_name || account.login_id };
    }
  }
  if (await verifyAdminCredentials(loginId, password)) return { accountId: "legacy-admin", loginId, role: "admin" as AccountRole, displayName: loginId };
  return null;
}
export async function createSession(user: SessionUser) {
  const payload = textToBase64Url(JSON.stringify({ ...user, expires: Math.floor(Date.now() / 1000) + SESSION_SECONDS }));
  return `${payload}.${await sign(payload)}`;
}
export async function requireSession(role?: AccountRole) {
  const token = (await cookies()).get(COOKIE_NAME)?.value || "";
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !process.env.ADMIN_SESSION_SECRET || !safeEqual(await sign(payload), signature)) return null;
  try {
    const data = JSON.parse(base64UrlToText(payload)) as SessionUser & { expires?: number };
    if (!data.accountId || !data.loginId || !ROLES.has(data.role) || !data.expires || data.expires < Date.now() / 1000) return null;
    if (role && data.role !== role) return null;
    return { accountId: data.accountId, loginId: data.loginId, role: data.role, displayName: data.displayName || data.loginId };
  } catch { return null; }
}
export async function requireAdmin() {
  return requireSession("admin");
}
export async function requireArtist() {
  return requireSession("artist");
}
export const adminCookie = { name: COOKIE_NAME, maxAge: SESSION_SECONDS };

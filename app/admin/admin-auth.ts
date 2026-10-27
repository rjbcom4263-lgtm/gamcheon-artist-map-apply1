import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { SIGNUP_PRIVACY_VERSION } from "../signup/privacy-consent";

const COOKIE_NAME = "gamcheon_session";
const SESSION_SECONDS = 60 * 60 * 8;
const ROLES = new Set(["admin", "artist"]);

export type AccountRole = "admin" | "artist";
export type SessionUser = { accountId: string; loginId: string; role: AccountRole; displayName: string };

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}
function textToBase64Url(value: string) { return bytesToBase64Url(new TextEncoder().encode(value)); }
function base64UrlToText(value: string) {
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
    return new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)));
  } catch { return ""; }
}
async function sign(value: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET || ""), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}
function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
export async function sha256Hex(value: string) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let different = 0;
  for (let i = 0; i < a.length; i++) different |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return different === 0;
}

// 계정 비밀번호는 사용자별 솔트를 섞은 PBKDF2-SHA256으로 저장합니다.
// 저장 형식: pbkdf2-sha256$<반복 횟수>$<솔트 base64url>$<해시 base64url>
// Cloudflare Workers의 WebCrypto는 PBKDF2 반복 횟수를 100,000회까지만 허용합니다.
const PASSWORD_HASH_PREFIX = "pbkdf2-sha256";
const PASSWORD_HASH_ITERATIONS = 100_000;
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_HASH_BITS = 256;

function base64UrlToBytes(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}
async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, PASSWORD_HASH_BITS);
  return bytesToBase64Url(new Uint8Array(bits));
}
export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
  return `${PASSWORD_HASH_PREFIX}$${PASSWORD_HASH_ITERATIONS}$${bytesToBase64Url(salt)}$${await pbkdf2(password, salt, PASSWORD_HASH_ITERATIONS)}`;
}
/** 저장된 해시와 비교합니다. 옛 형식(솔트 없는 SHA-256 hex)도 받아들이되 needsRehash로 표시해 로그인 시 새 형식으로 바꿉니다. */
export async function verifyPassword(password: string, stored: string): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (stored.startsWith(`${PASSWORD_HASH_PREFIX}$`)) {
    const [, iterationsText, saltText, hashText] = stored.split("$");
    const iterations = Number(iterationsText);
    if (!Number.isInteger(iterations) || iterations <= 0 || !saltText || !hashText) return { ok: false, needsRehash: false };
    try {
      const derived = await pbkdf2(password, base64UrlToBytes(saltText), iterations);
      return { ok: safeEqual(derived, hashText), needsRehash: iterations !== PASSWORD_HASH_ITERATIONS };
    } catch {
      return { ok: false, needsRehash: false };
    }
  }
  return { ok: safeEqual(await sha256Hex(password), stored), needsRehash: true };
}
/** 관리자가 초기화할 때 쓰는 임시 비밀번호. 헷갈리는 글자(0/O, 1/l/I)를 뺀 32자 집합에서 12자를 뽑습니다. */
export function generateTemporaryPassword(length = 12) {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
}

export async function verifyAdminCredentials(username: string, password: string) {
  return safeEqual(username, process.env.ADMIN_USERNAME || "") && safeEqual(await sha256Hex(password), process.env.ADMIN_PASSWORD_HASH || "");
}
export async function ensureAccountTables() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY NOT NULL,
    login_id TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'artist')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'deleted')),
    display_name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TEXT
  )`).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_accounts_role ON accounts (role)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts (status)").run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS account_privacy_consents (
    account_id TEXT PRIMARY KEY NOT NULL,
    version TEXT NOT NULL,
    required_accepted_at TEXT NOT NULL,
    email_accepted_at TEXT
  )`).run();
}
function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
export async function createArtistAccount(input: { loginId?: string; password?: string; displayName?: string; phone?: string; email?: string; consentRequired?: unknown; consentEmail?: unknown; privacyVersion?: unknown }) {
  if (input.consentRequired !== true || input.privacyVersion !== SIGNUP_PRIVACY_VERSION) return { error: "현재 개인정보 안내를 확인하고 필수 항목에 동의해 주세요.", status: 400 };
  await ensureAccountTables();
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
  await ensureAccountTables();
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

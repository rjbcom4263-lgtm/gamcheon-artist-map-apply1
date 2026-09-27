import { env } from "cloudflare:workers";
import { cookies } from "next/headers";

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
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let different = 0;
  for (let i = 0; i < a.length; i++) different |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return different === 0;
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
}
function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
export async function createArtistAccount(input: { loginId?: string; password?: string; displayName?: string; phone?: string; email?: string }) {
  await ensureAccountTables();
  const loginId = cleanText(input.loginId, 150);
  const password = typeof input.password === "string" ? input.password : "";
  const displayName = cleanText(input.displayName, 100);
  const phone = cleanText(input.phone, 30);
  const email = cleanText(input.email, 150);
  if (!loginId || !password || !displayName || !phone) return { error: "필수 정보를 모두 입력해주세요.", status: 400 };
  const id = `ACC-${crypto.randomUUID()}`;
  try {
    await env.DB.prepare("INSERT INTO accounts (id, login_id, password_hash, role, status, display_name, phone, email) VALUES (?, ?, ?, 'artist', 'pending', ?, ?, ?)")
      .bind(id, loginId, await sha256Hex(password), displayName, phone, email).run();
    return { account: { id, loginId, role: "artist" as AccountRole, status: "pending", displayName } };
  } catch {
    return { error: "이미 사용 중인 아이디입니다.", status: 409 };
  }
}
export async function verifyCredentials(loginId: string, password: string) {
  await ensureAccountTables();
  const account = await env.DB.prepare("SELECT id, login_id, password_hash, role, status, display_name FROM accounts WHERE login_id = ?")
    .bind(loginId).first<{ id: string; login_id: string; password_hash: string; role: string; status: string; display_name: string }>();
  if (account && account.status !== "deleted" && account.status !== "suspended" && ROLES.has(account.role) && safeEqual(await sha256Hex(password), account.password_hash)) {
    await env.DB.prepare("UPDATE accounts SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?").bind(account.id).run();
    return { accountId: account.id, loginId: account.login_id, role: account.role as AccountRole, displayName: account.display_name || account.login_id };
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

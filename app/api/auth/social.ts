import { env } from "cloudflare:workers";
import { adminCookie, createSession, ensureAccountTables, sha256Hex } from "../../admin/admin-auth";
import { AUTH_NEXT_COOKIE, safeNextPath } from "../../auth-next";

export type SocialProvider = "google" | "kakao" | "naver";
type Account = { id: string; login_id: string; role: string; status: string; display_name: string };

export function socialError(origin: string, provider: SocialProvider, code: string, stateCookie: string, nextPath = "/") {
  const headers = new Headers({ location: `${origin}/login?error=${provider}_${code}&next=${encodeURIComponent(safeNextPath(nextPath, "/"))}` });
  headers.append("set-cookie", `${stateCookie}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  headers.append("set-cookie", `${AUTH_NEXT_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  return new Response(null, { status: 303, headers });
}

export async function completeSocialLogin(input: { provider: SocialProvider; providerUserId: string; email?: string; displayName?: string; origin: string; stateCookie: string; nextPath?: string }) {
  const { provider, providerUserId, origin, stateCookie } = input;
  const nextPath = safeNextPath(input.nextPath, "/");
  const email = input.email?.trim().toLowerCase().slice(0, 150) || "";
  const displayName = input.displayName?.trim().slice(0, 100) || email.split("@")[0] || provider;

  await ensureAccountTables();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS social_accounts (
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (provider, provider_user_id)
  )`).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_social_accounts_account ON social_accounts (account_id)").run();

  let account = await env.DB.prepare(`SELECT a.id, a.login_id, a.role, a.status, a.display_name FROM social_accounts s
    JOIN accounts a ON a.id = s.account_id WHERE s.provider = ? AND s.provider_user_id = ?`).bind(provider, providerUserId).first<Account>();
  if (!account) {
    const id = `ACC-${crypto.randomUUID()}`;
    const loginId = `${provider}_${providerUserId}`;
    await env.DB.prepare("INSERT INTO accounts (id, login_id, password_hash, role, status, display_name, phone, email) VALUES (?, ?, ?, 'artist', 'pending', ?, '', ?)")
      .bind(id, loginId, await sha256Hex(crypto.randomUUID()), displayName, email).run();
    account = { id, login_id: loginId, role: "artist", status: "pending", display_name: displayName };
  }
  if (account.role !== "artist" || account.status === "suspended" || account.status === "deleted") return socialError(origin, provider, "account", stateCookie, nextPath);

  await env.DB.prepare("INSERT OR IGNORE INTO social_accounts (provider, provider_user_id, account_id, email) VALUES (?, ?, ?, ?)").bind(provider, providerUserId, account.id, email).run();
  await env.DB.prepare("UPDATE accounts SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?").bind(account.id).run();
  const session = await createSession({ accountId: account.id, loginId: account.login_id, role: "artist", displayName: account.display_name || displayName });
  const headers = new Headers({ location: `${origin}${nextPath}` });
  headers.append("set-cookie", `${adminCookie.name}=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${adminCookie.maxAge}`);
  headers.append("set-cookie", `${stateCookie}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  headers.append("set-cookie", `${AUTH_NEXT_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  headers.set("cache-control", "no-store");
  return new Response(null, { status: 303, headers });
}

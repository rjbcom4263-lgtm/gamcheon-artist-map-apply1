import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { adminCookie, createSession, ensureAccountTables, sha256Hex } from "../../../../admin/admin-auth";
import { AUTH_NEXT_COOKIE, safeNextCookie } from "../../../../auth-next";

const STATE_COOKIE = "gamcheon_google_state";
export const runtime = "edge";

type GoogleUser = { sub?: string; email?: string; email_verified?: boolean; name?: string };
type Account = { id: string; login_id: string; role: "artist" | "admin"; status: string; display_name: string };

function redirectError(origin: string, code: string, nextPath: string) {
  const headers = new Headers({ location: `${origin}/login?error=${code}&next=${encodeURIComponent(nextPath)}` });
  headers.append("set-cookie", `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  headers.append("set-cookie", `${AUTH_NEXT_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  return new Response(null, { status: 303, headers });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const state = url.searchParams.get("state") || "";
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value || "";
  const nextPath = safeNextCookie(cookieStore.get(AUTH_NEXT_COOKIE)?.value);
  const code = url.searchParams.get("code") || "";
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  if (!state || !expectedState || state !== expectedState || !code || !clientId || !clientSecret) return redirectError(origin, "google_state", nextPath);

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: `${origin}/api/auth/google/callback`, grant_type: "authorization_code" }),
    });
    const token = await tokenResponse.json() as { access_token?: string };
    if (!tokenResponse.ok || !token.access_token) return redirectError(origin, "google_token", nextPath);

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${token.access_token}` } });
    const profile = await profileResponse.json() as GoogleUser;
    const email = profile.email?.trim().toLowerCase() || "";
    if (!profileResponse.ok || !profile.sub || !email || profile.email_verified !== true) return redirectError(origin, "google_profile", nextPath);

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
      JOIN accounts a ON a.id = s.account_id WHERE s.provider = 'google' AND s.provider_user_id = ?`).bind(profile.sub).first<Account>();
    if (!account) {
      const id = `ACC-${crypto.randomUUID()}`;
      const loginId = `google_${profile.sub}`;
      const displayName = profile.name?.trim().slice(0, 100) || email.split("@")[0];
      await env.DB.prepare("INSERT INTO accounts (id, login_id, password_hash, role, status, display_name, phone, email) VALUES (?, ?, ?, 'artist', 'pending', ?, '', ?)")
        .bind(id, loginId, await sha256Hex(crypto.randomUUID()), displayName, email).run();
      account = { id, login_id: loginId, role: "artist", status: "pending", display_name: displayName };
    }
    if ((account.role !== "artist" && account.role !== "admin") || account.status === "suspended" || account.status === "deleted") return redirectError(origin, "google_account", nextPath);

    await env.DB.prepare("INSERT OR IGNORE INTO social_accounts (provider, provider_user_id, account_id, email) VALUES ('google', ?, ?, ?)").bind(profile.sub, account.id, email).run();
    await env.DB.prepare("UPDATE accounts SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?").bind(account.id).run();
    const session = await createSession({ accountId: account.id, loginId: account.login_id, role: account.role, displayName: account.display_name || email });
    const headers = new Headers({ location: `${origin}${account.role === "admin" && nextPath === "/" ? "/admin" : nextPath}` });
    headers.append("set-cookie", `${adminCookie.name}=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${adminCookie.maxAge}`);
    headers.append("set-cookie", `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
    headers.append("set-cookie", `${AUTH_NEXT_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
    return new Response(null, { status: 303, headers });
  } catch (error) {
    console.error("google login failed", error);
    return redirectError(origin, "google_failed", nextPath);
  }
}

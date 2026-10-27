import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { adminCookie, createSession, hashPassword } from "../../admin/admin-auth";
import { AUTH_NEXT_COOKIE, safeNextCookie, safeNextPath } from "../../auth-next";
import { clearCookie, cookie, redirectWithCookies } from "../../lib/http";

export type SocialProvider = "google" | "kakao" | "naver";
type Account = { id: string; login_id: string; role: string; status: string; display_name: string };

const STATE_COOKIE_MAX_AGE = 600;

export function stateCookieName(provider: SocialProvider) {
  return `gamcheon_${provider}_state`;
}

/** 로그인 실패 시 /login으로 돌려보내며 state·next 쿠키를 지웁니다. 오류 코드는 `${provider}_${code}` 형태로 전달됩니다. */
export function socialError(origin: string, provider: SocialProvider, code: string, nextPath = "/") {
  return redirectWithCookies(
    `${origin}/login?error=${provider}_${code}&next=${encodeURIComponent(safeNextPath(nextPath, "/"))}`,
    [clearCookie(stateCookieName(provider)), clearCookie(AUTH_NEXT_COOKIE)],
  );
}

/** 소셜 로그인 시작: state와 돌아올 경로를 쿠키에 담고 제공자 인증 페이지로 보냅니다. 세 제공자의 start 라우트가 공통으로 씁니다. */
export function startSocialLogin(request: Request, input: { provider: SocialProvider; clientId: string; authorizeUrl: string; params: (state: string, redirectUri: string) => Record<string, string> }) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const nextPath = safeNextPath(requestUrl.searchParams.get("next"), "/");
  if (!input.clientId) return Response.redirect(new URL(`/login?error=${input.provider}_config&next=${encodeURIComponent(nextPath)}`, origin), 303);

  const state = crypto.randomUUID();
  const authorize = new URL(input.authorizeUrl);
  authorize.search = new URLSearchParams(input.params(state, `${origin}/api/auth/${input.provider}/callback`)).toString();
  return redirectWithCookies(authorize.toString(), [
    cookie(stateCookieName(input.provider), state, STATE_COOKIE_MAX_AGE),
    cookie(AUTH_NEXT_COOKIE, encodeURIComponent(nextPath), STATE_COOKIE_MAX_AGE),
  ], 302);
}

/** 콜백 라우트 공통 전처리: state 쿠키 검증, code·next 경로 추출. 실패하면 null. */
export async function readSocialCallback(request: Request, provider: SocialProvider) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") || "";
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(stateCookieName(provider))?.value || "";
  const nextPath = safeNextCookie(cookieStore.get(AUTH_NEXT_COOKIE)?.value);
  const code = url.searchParams.get("code") || "";
  const ok = !!state && !!expectedState && state === expectedState && !!code;
  return { origin: url.origin, code, state, nextPath, ok };
}

/**
 * 제공자 사용자 id로 계정을 찾거나 새로 만들고 세션을 발급합니다.
 * 이메일로는 기존 계정을 연결하지 않습니다(제공자가 이메일을 검증하지 않을 수 있음).
 * allowAdmin이면 관리자 계정도 이 제공자로 로그인할 수 있고, 돌아갈 곳이 홈이면 /admin으로 보냅니다.
 */
export async function completeSocialLogin(input: { provider: SocialProvider; providerUserId: string; email?: string; displayName?: string; origin: string; nextPath?: string; allowAdmin?: boolean }) {
  const { provider, providerUserId, origin } = input;
  const nextPath = safeNextPath(input.nextPath, "/");
  const email = input.email?.trim().toLowerCase().slice(0, 150) || "";
  const displayName = input.displayName?.trim().slice(0, 100) || email.split("@")[0] || provider;

  let account = await env.DB.prepare(`SELECT a.id, a.login_id, a.role, a.status, a.display_name FROM social_accounts s
    JOIN accounts a ON a.id = s.account_id WHERE s.provider = ? AND s.provider_user_id = ?`).bind(provider, providerUserId).first<Account>();
  if (!account) {
    const id = `ACC-${crypto.randomUUID()}`;
    const loginId = `${provider}_${providerUserId}`;
    await env.DB.prepare("INSERT INTO accounts (id, login_id, password_hash, role, status, display_name, phone, email) VALUES (?, ?, ?, 'artist', 'pending', ?, '', ?)")
      .bind(id, loginId, await hashPassword(crypto.randomUUID()), displayName, email).run();
    account = { id, login_id: loginId, role: "artist", status: "pending", display_name: displayName };
  }
  const roleAllowed = account.role === "artist" || (input.allowAdmin && account.role === "admin");
  if (!roleAllowed || account.status === "suspended" || account.status === "deleted") return socialError(origin, provider, "account", nextPath);

  await env.DB.prepare("INSERT OR IGNORE INTO social_accounts (provider, provider_user_id, account_id, email) VALUES (?, ?, ?, ?)").bind(provider, providerUserId, account.id, email).run();
  await env.DB.prepare("UPDATE accounts SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?").bind(account.id).run();
  const role = account.role === "admin" ? "admin" : "artist";
  const session = await createSession({ accountId: account.id, loginId: account.login_id, role, displayName: account.display_name || displayName });
  const location = `${origin}${role === "admin" && nextPath === "/" ? "/admin" : nextPath}`;
  const response = redirectWithCookies(location, [
    cookie(adminCookie.name, session, adminCookie.maxAge),
    clearCookie(stateCookieName(provider)),
    clearCookie(AUTH_NEXT_COOKIE),
  ]);
  response.headers.set("cache-control", "no-store");
  return response;
}

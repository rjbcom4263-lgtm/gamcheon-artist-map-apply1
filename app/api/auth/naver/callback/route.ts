import { cookies } from "next/headers";
import { completeSocialLogin, socialError } from "../../social";
import { AUTH_NEXT_COOKIE, safeNextCookie } from "../../../../auth-next";

const STATE_COOKIE = "gamcheon_naver_state";
export const runtime = "edge";

type NaverProfile = { resultcode?: string; response?: { id?: string; email?: string; nickname?: string; name?: string } };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const state = url.searchParams.get("state") || "";
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value || "";
  const nextPath = safeNextCookie(cookieStore.get(AUTH_NEXT_COOKIE)?.value);
  const code = url.searchParams.get("code") || "";
  const clientId = process.env.NAVER_CLIENT_ID || "";
  const clientSecret = process.env.NAVER_CLIENT_SECRET || "";
  if (!state || !expectedState || state !== expectedState || !code || !clientId || !clientSecret) return socialError(origin, "naver", "state", STATE_COOKIE, nextPath);

  try {
    const tokenResponse = await fetch("https://nid.naver.com/oauth2.0/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, client_secret: clientSecret, code, state }) });
    const token = await tokenResponse.json() as { access_token?: string };
    if (!tokenResponse.ok || !token.access_token) return socialError(origin, "naver", "token", STATE_COOKIE, nextPath);

    const profileResponse = await fetch("https://openapi.naver.com/v1/nid/me", { headers: { authorization: `Bearer ${token.access_token}` } });
    const profile = await profileResponse.json() as NaverProfile;
    if (!profileResponse.ok || profile.resultcode !== "00" || !profile.response?.id) return socialError(origin, "naver", "profile", STATE_COOKIE, nextPath);
    return completeSocialLogin({ provider: "naver", providerUserId: profile.response.id, email: profile.response.email, displayName: profile.response.nickname || profile.response.name, origin, stateCookie: STATE_COOKIE, nextPath });
  } catch (error) {
    console.error("naver login failed", error);
    return socialError(origin, "naver", "failed", STATE_COOKIE, nextPath);
  }
}

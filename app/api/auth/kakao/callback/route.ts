import { cookies } from "next/headers";
import { completeSocialLogin, socialError } from "../../social";
import { AUTH_NEXT_COOKIE, safeNextCookie } from "../../../../auth-next";

const STATE_COOKIE = "gamcheon_kakao_state";
export const runtime = "edge";

type KakaoProfile = { id?: number | string; kakao_account?: { email?: string; is_email_valid?: boolean; is_email_verified?: boolean; name?: string; profile?: { nickname?: string } } };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const state = url.searchParams.get("state") || "";
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value || "";
  const nextPath = safeNextCookie(cookieStore.get(AUTH_NEXT_COOKIE)?.value);
  const code = url.searchParams.get("code") || "";
  const clientId = process.env.KAKAO_REST_API_KEY || "";
  const clientSecret = process.env.KAKAO_CLIENT_SECRET || "";
  if (!state || !expectedState || state !== expectedState || !code || !clientId || !clientSecret) return socialError(origin, "kakao", "state", STATE_COOKIE, nextPath);

  try {
    const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, client_secret: clientSecret, redirect_uri: `${origin}/api/auth/kakao/callback`, code }) });
    const token = await tokenResponse.json() as { access_token?: string };
    if (!tokenResponse.ok || !token.access_token) return socialError(origin, "kakao", "token", STATE_COOKIE, nextPath);

    const profileResponse = await fetch("https://kapi.kakao.com/v2/user/me", { headers: { authorization: `Bearer ${token.access_token}`, "content-type": "application/x-www-form-urlencoded;charset=utf-8" } });
    const profile = await profileResponse.json() as KakaoProfile;
    if (!profileResponse.ok || profile.id === undefined) return socialError(origin, "kakao", "profile", STATE_COOKIE, nextPath);
    const account = profile.kakao_account;
    const email = account?.is_email_valid && account.is_email_verified ? account.email : "";
    return completeSocialLogin({ provider: "kakao", providerUserId: String(profile.id), email, displayName: account?.profile?.nickname || account?.name, origin, stateCookie: STATE_COOKIE, nextPath });
  } catch (error) {
    console.error("kakao login failed", error);
    return socialError(origin, "kakao", "failed", STATE_COOKIE, nextPath);
  }
}

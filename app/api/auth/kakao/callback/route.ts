import { completeSocialLogin, readSocialCallback, socialError } from "../../social";

export const runtime = "edge";

type KakaoProfile = { id?: number | string; kakao_account?: { email?: string; is_email_valid?: boolean; is_email_verified?: boolean; name?: string; profile?: { nickname?: string } } };

export async function GET(request: Request) {
  const { origin, code, state, nextPath, ok } = await readSocialCallback(request, "kakao");
  const clientId = process.env.KAKAO_REST_API_KEY || "";
  const clientSecret = process.env.KAKAO_CLIENT_SECRET || "";
  if (!ok || !clientId || !clientSecret) return socialError(origin, "kakao", "state", nextPath);
  void state;

  try {
    const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, client_secret: clientSecret, redirect_uri: `${origin}/api/auth/kakao/callback`, code }) });
    const token = await tokenResponse.json() as { access_token?: string };
    if (!tokenResponse.ok || !token.access_token) return socialError(origin, "kakao", "token", nextPath);

    const profileResponse = await fetch("https://kapi.kakao.com/v2/user/me", { headers: { authorization: `Bearer ${token.access_token}`, "content-type": "application/x-www-form-urlencoded;charset=utf-8" } });
    const profile = await profileResponse.json() as KakaoProfile;
    if (!profileResponse.ok || profile.id === undefined) return socialError(origin, "kakao", "profile", nextPath);
    const account = profile.kakao_account;
    const email = account?.is_email_valid && account.is_email_verified ? account.email : "";
    return completeSocialLogin({ provider: "kakao", providerUserId: String(profile.id), email, displayName: account?.profile?.nickname || account?.name, origin, nextPath });
  } catch (error) {
    console.error("kakao login failed", error);
    return socialError(origin, "kakao", "failed", nextPath);
  }
}

import { completeSocialLogin, readSocialCallback, socialError } from "../../social";

export const runtime = "edge";

type NaverProfile = { resultcode?: string; response?: { id?: string; email?: string; nickname?: string; name?: string } };

export async function GET(request: Request) {
  const { origin, code, state, nextPath, ok } = await readSocialCallback(request, "naver");
  const clientId = process.env.NAVER_CLIENT_ID || "";
  const clientSecret = process.env.NAVER_CLIENT_SECRET || "";
  if (!ok || !clientId || !clientSecret) return socialError(origin, "naver", "state", nextPath);

  try {
    const tokenResponse = await fetch("https://nid.naver.com/oauth2.0/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, client_secret: clientSecret, code, state }) });
    const token = await tokenResponse.json() as { access_token?: string };
    if (!tokenResponse.ok || !token.access_token) return socialError(origin, "naver", "token", nextPath);

    const profileResponse = await fetch("https://openapi.naver.com/v1/nid/me", { headers: { authorization: `Bearer ${token.access_token}` } });
    const profile = await profileResponse.json() as NaverProfile;
    if (!profileResponse.ok || profile.resultcode !== "00" || !profile.response?.id) return socialError(origin, "naver", "profile", nextPath);
    return completeSocialLogin({ provider: "naver", providerUserId: profile.response.id, email: profile.response.email, displayName: profile.response.nickname || profile.response.name, origin, nextPath });
  } catch (error) {
    console.error("naver login failed", error);
    return socialError(origin, "naver", "failed", nextPath);
  }
}

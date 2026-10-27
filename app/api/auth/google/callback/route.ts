import { completeSocialLogin, readSocialCallback, socialError } from "../../social";

export const runtime = "edge";

type GoogleUser = { sub?: string; email?: string; email_verified?: boolean; name?: string };

// Google은 관리자 계정도 로그인할 수 있는 유일한 소셜 제공자입니다(allowAdmin).
export async function GET(request: Request) {
  const { origin, code, nextPath, ok } = await readSocialCallback(request, "google");
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  if (!ok || !clientId || !clientSecret) return socialError(origin, "google", "state", nextPath);

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: `${origin}/api/auth/google/callback`, grant_type: "authorization_code" }),
    });
    const token = await tokenResponse.json() as { access_token?: string };
    if (!tokenResponse.ok || !token.access_token) return socialError(origin, "google", "token", nextPath);

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${token.access_token}` } });
    const profile = await profileResponse.json() as GoogleUser;
    const email = profile.email?.trim().toLowerCase() || "";
    if (!profileResponse.ok || !profile.sub || !email || profile.email_verified !== true) return socialError(origin, "google", "profile", nextPath);

    return completeSocialLogin({ provider: "google", providerUserId: profile.sub, email, displayName: profile.name || email.split("@")[0], origin, nextPath, allowAdmin: true });
  } catch (error) {
    console.error("google login failed", error);
    return socialError(origin, "google", "failed", nextPath);
  }
}

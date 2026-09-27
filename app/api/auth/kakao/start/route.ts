import { AUTH_NEXT_COOKIE, safeNextPath } from "../../../../auth-next";

const STATE_COOKIE = "gamcheon_kakao_state";

export const runtime = "edge";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const nextPath = safeNextPath(requestUrl.searchParams.get("next"), "/");
  const clientId = process.env.KAKAO_REST_API_KEY || "";
  if (!clientId) return Response.redirect(new URL(`/login?error=kakao_config&next=${encodeURIComponent(nextPath)}`, origin), 303);

  const state = crypto.randomUUID();
  const authorize = new URL("https://kauth.kakao.com/oauth/authorize");
  authorize.search = new URLSearchParams({ client_id: clientId, redirect_uri: `${origin}/api/auth/kakao/callback`, response_type: "code", state }).toString();
  const headers = new Headers({ location: authorize.toString() });
  headers.append("set-cookie", `${STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  headers.append("set-cookie", `${AUTH_NEXT_COOKIE}=${encodeURIComponent(nextPath)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  return new Response(null, { status: 302, headers });
}

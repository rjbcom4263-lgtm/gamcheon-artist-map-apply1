import { AUTH_NEXT_COOKIE, safeNextPath } from "../../../../auth-next";

const STATE_COOKIE = "gamcheon_google_state";

export const runtime = "edge";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const nextPath = safeNextPath(requestUrl.searchParams.get("next"), "/");
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  if (!clientId) return Response.redirect(new URL(`/login?error=google_config&next=${encodeURIComponent(nextPath)}`, origin), 303);

  const state = crypto.randomUUID();
  const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorize.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();

  const headers = new Headers({ location: authorize.toString() });
  headers.append("set-cookie", `${STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  headers.append("set-cookie", `${AUTH_NEXT_COOKIE}=${encodeURIComponent(nextPath)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  return new Response(null, { status: 302, headers });
}

import { startSocialLogin } from "../../social";

export const runtime = "edge";

export async function GET(request: Request) {
  return startSocialLogin(request, {
    provider: "google",
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    params: (state, redirectUri) => ({ client_id: process.env.GOOGLE_CLIENT_ID || "", redirect_uri: redirectUri, response_type: "code", scope: "openid email profile", state, prompt: "select_account" }),
  });
}

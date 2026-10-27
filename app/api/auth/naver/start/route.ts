import { startSocialLogin } from "../../social";

export const runtime = "edge";

export async function GET(request: Request) {
  return startSocialLogin(request, {
    provider: "naver",
    clientId: process.env.NAVER_CLIENT_ID || "",
    authorizeUrl: "https://nid.naver.com/oauth2.0/authorize",
    params: (state, redirectUri) => ({ response_type: "code", client_id: process.env.NAVER_CLIENT_ID || "", redirect_uri: redirectUri, state }),
  });
}

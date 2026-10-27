import { startSocialLogin } from "../../social";

export const runtime = "edge";

export async function GET(request: Request) {
  return startSocialLogin(request, {
    provider: "kakao",
    clientId: process.env.KAKAO_REST_API_KEY || "",
    authorizeUrl: "https://kauth.kakao.com/oauth/authorize",
    params: (state, redirectUri) => ({ client_id: process.env.KAKAO_REST_API_KEY || "", redirect_uri: redirectUri, response_type: "code", state }),
  });
}

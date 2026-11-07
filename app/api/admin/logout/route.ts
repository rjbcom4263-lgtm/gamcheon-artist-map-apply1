import { SESSION_COOKIE } from "../../../admin/session-token";
import { clearCookie, redirectWithCookies } from "../../../lib/http";

export const runtime = "edge";

// 로그아웃은 POST로만 받습니다(GET 강제 로그아웃 방지).
export async function POST(request: Request) {
  return redirectWithCookies(new URL("/login", request.url).toString(), [clearCookie(SESSION_COOKIE.name)]);
}

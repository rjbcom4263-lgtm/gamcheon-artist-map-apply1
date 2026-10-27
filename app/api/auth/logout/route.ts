import { adminCookie } from "../../../admin/admin-auth";
import { clearCookie, redirectWithCookies } from "../../../lib/http";

export const runtime = "edge";

// 로그아웃은 POST로만 받습니다. GET이면 <img src> 한 줄로 남을 강제 로그아웃시킬 수 있습니다.
export async function POST(request: Request) {
  return redirectWithCookies(new URL("/login", request.url).toString(), [clearCookie(adminCookie.name)]);
}

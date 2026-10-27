import { adminCookie } from "../../../admin/admin-auth";
export const runtime = "edge";
// 로그아웃은 POST로만 받습니다(GET 강제 로그아웃 방지).
export async function POST(request: Request) {
  return new Response(null, { status: 303, headers: { location: new URL("/login", request.url).toString(), "set-cookie": `${adminCookie.name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` } });
}

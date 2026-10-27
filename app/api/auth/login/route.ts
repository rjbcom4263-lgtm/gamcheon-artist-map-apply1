import { adminCookie, createSession, verifyCredentials } from "../../../admin/admin-auth";
import { cookie, jsonError } from "../../../lib/http";

export const runtime = "edge";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { loginId?: string; password?: string };
  const user = body.loginId && body.password ? await verifyCredentials(body.loginId, body.password) : null;
  if (!user) return jsonError("로그인 정보가 올바르지 않습니다.", 401);
  const session = await createSession(user);
  return new Response(JSON.stringify({ ok: true, role: user.role, redirectTo: "/" }), {
    headers: { "content-type": "application/json", "set-cookie": cookie(adminCookie.name, session, adminCookie.maxAge) },
  });
}

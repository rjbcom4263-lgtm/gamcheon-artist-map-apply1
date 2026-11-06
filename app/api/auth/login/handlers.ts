import { verifyCredentials } from "../../../admin/credentials.ts";
import { SESSION_COOKIE } from "../../../admin/session-cookie.ts";
import type { ApiContext } from "../../../lib/api-context";
import { loginAttempts, tooManyAttempts } from "../../../lib/auth-attempts.ts";
import { cookie, jsonError } from "../../../lib/http.ts";

export async function logIn(request: Request, context: ApiContext) {
  const body = await request.json().catch(() => ({})) as { loginId?: unknown; password?: unknown } | null;
  const loginId = typeof body?.loginId === "string" ? body.loginId : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const wrong = () => jsonError("로그인 정보가 올바르지 않습니다.", 401);
  if (!loginId || !password) return wrong();

  const attempts = await loginAttempts(context.DB, request, loginId);
  const blocked = await attempts.blockedFor();
  if (blocked) return tooManyAttempts(blocked, "로그인");

  const user = await verifyCredentials(context.DB, loginId, password);
  if (!user) {
    await attempts.fail();
    return wrong();
  }
  await attempts.succeed();
  const session = await context.issueSession(user);
  return new Response(JSON.stringify({ ok: true, role: user.role, redirectTo: "/" }), {
    headers: { "content-type": "application/json", "set-cookie": cookie(SESSION_COOKIE.name, session, SESSION_COOKIE.maxAge) },
  });
}

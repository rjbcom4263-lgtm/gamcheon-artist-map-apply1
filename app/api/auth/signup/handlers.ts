import { createArtistAccount, type SignupInput } from "../../../admin/credentials.ts";
import { SESSION_COOKIE } from "../../../admin/session-cookie.ts";
import type { ApiContext } from "../../../lib/api-context";
import { signupAttempts, tooManyAttempts } from "../../../lib/auth-attempts.ts";
import { cookie, jsonError } from "../../../lib/http.ts";

export async function signUp(request: Request, context: ApiContext) {
  const attempts = await signupAttempts(context.DB, request);
  const blocked = await attempts.blockedFor();
  if (blocked) return tooManyAttempts(blocked, "가입");

  const body = await request.json().catch(() => ({})) as SignupInput | null;
  const result = await createArtistAccount(context.DB, body ?? {});
  // 입력을 고치는 정상 사용자가 막히지 않게, 계정을 실제로 만들려 한 요청만 셉니다. 이미 있는 아이디는 아이디를 찾아보는 요청일 수 있어 함께 셉니다.
  if (result.account || result.status === 409) await attempts.count();
  if (!result.account) return jsonError(result.error ?? "회원가입을 완료하지 못했습니다.", result.status ?? 400);
  const { account } = result;
  const session = await context.issueSession({ accountId: account.id, loginId: account.loginId, role: "artist", displayName: account.displayName, sessionVersion: account.sessionVersion });
  return new Response(JSON.stringify({ ok: true, role: "artist", redirectTo: "/artist" }), {
    headers: { "content-type": "application/json", "set-cookie": cookie(SESSION_COOKIE.name, session, SESSION_COOKIE.maxAge) },
  });
}

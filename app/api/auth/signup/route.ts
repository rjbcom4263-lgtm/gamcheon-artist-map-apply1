import { adminCookie, createArtistAccount, createSession } from "../../../admin/admin-auth";
import { cookie, jsonError } from "../../../lib/http";

export const runtime = "edge";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { loginId?: string; password?: string; displayName?: string; phone?: string; email?: string; consentRequired?: unknown; consentEmail?: unknown; privacyVersion?: unknown };
  const result = await createArtistAccount(body);
  if (!result.account) return jsonError(result.error ?? "회원가입을 완료하지 못했습니다.", result.status ?? 400);
  const { account } = result;
  const session = await createSession({ accountId: account.id, loginId: account.loginId, role: "artist", displayName: account.displayName, sessionVersion: account.sessionVersion });
  return new Response(JSON.stringify({ ok: true, role: "artist", redirectTo: "/artist" }), {
    headers: { "content-type": "application/json", "set-cookie": cookie(adminCookie.name, session, adminCookie.maxAge) },
  });
}

import { env } from "cloudflare:workers";
import { adminCookie, createSession, hashPassword, requireArtist, verifyPassword } from "../../../admin/admin-auth";
import { passwordProblem } from "../../../lib/account-rules";
import { cookie, forbidden } from "../../../lib/http";

export const runtime = "edge";

export async function PATCH(request: Request) {
  const artist = await requireArtist();
  if (!artist) return forbidden("로그인이 필요합니다.");
  const body = await request.json().catch(() => ({})) as { currentPassword?: string; newPassword?: string };
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (!currentPassword || !newPassword) return Response.json({ error: "비밀번호를 입력해주세요." }, { status: 400 });
  const problem = passwordProblem(newPassword);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  const account = await env.DB.prepare("SELECT password_hash FROM accounts WHERE id = ? AND role = 'artist'")
    .bind(artist.accountId).first<{ password_hash: string }>();
  if (!account || !(await verifyPassword(currentPassword, account.password_hash)).ok) return Response.json({ error: "현재 비밀번호가 맞지 않습니다." }, { status: 400 });

  // 비밀번호를 바꾸면 세션 버전을 올려 다른 기기의 세션을 끊고, 지금 이 기기에는 새 버전의 세션을 다시 발급합니다.
  const updated = await env.DB.prepare("UPDATE accounts SET password_hash = ?, session_version = session_version + 1 WHERE id = ? AND role = 'artist' RETURNING session_version")
    .bind(await hashPassword(newPassword), artist.accountId).first<{ session_version: number }>();
  if (!updated) return Response.json({ error: "비밀번호를 바꾸지 못했습니다." }, { status: 500 });
  const session = await createSession({ ...artist, sessionVersion: updated.session_version });
  return Response.json({ ok: true }, { headers: { "set-cookie": cookie(adminCookie.name, session, adminCookie.maxAge) } });
}

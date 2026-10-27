import { env } from "cloudflare:workers";
import { hashPassword, requireArtist, verifyPassword } from "../../../admin/admin-auth";

export const runtime = "edge";

export async function PATCH(request: Request) {
  const artist = await requireArtist();
  if (!artist) return Response.json({ error: "로그인이 필요합니다." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { currentPassword?: string; newPassword?: string };
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (!currentPassword || !newPassword) return Response.json({ error: "비밀번호를 입력해주세요." }, { status: 400 });

  const account = await env.DB.prepare("SELECT password_hash FROM accounts WHERE id = ? AND role = 'artist'")
    .bind(artist.accountId).first<{ password_hash: string }>();
  if (!account || !(await verifyPassword(currentPassword, account.password_hash)).ok) return Response.json({ error: "현재 비밀번호가 맞지 않습니다." }, { status: 400 });

  await env.DB.prepare("UPDATE accounts SET password_hash = ? WHERE id = ? AND role = 'artist'")
    .bind(await hashPassword(newPassword), artist.accountId).run();
  return Response.json({ ok: true });
}

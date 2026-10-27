import { env } from "cloudflare:workers";
import { generateTemporaryPassword, hashPassword, requireAdmin } from "../../../../admin/admin-auth";
import { forbidden } from "../../../../lib/http";

export const runtime = "edge";
const allowedStatuses = new Set(["pending", "active", "suspended"]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return forbidden();
  const { id } = await context.params;
  const body = await request.json().catch(() => ({})) as { status?: string; resetPassword?: boolean; promoteAdmin?: boolean };
  if (body.promoteAdmin) {
    const result = await env.DB.prepare("UPDATE accounts SET role = 'admin', status = 'active' WHERE id = ? AND role = 'artist' AND status != 'deleted'")
      .bind(id).run();
    if (!result.meta.changes) return Response.json({ error: "승격할 계정을 찾지 못했습니다. 이미 관리자이거나 삭제된 계정일 수 있습니다." }, { status: 404 });
    return Response.json({ ok: true, role: "admin", status: "active" });
  }
  if (body.resetPassword) {
    // 고정값 대신 매번 새 임시 비밀번호를 만들어 관리자 화면에 한 번만 보여 줍니다.
    const temporaryPassword = generateTemporaryPassword();
    const result = await env.DB.prepare("UPDATE accounts SET password_hash = ? WHERE id = ? AND role = 'artist'")
      .bind(await hashPassword(temporaryPassword), id).run();
    if (!result.meta.changes) return Response.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });
    return Response.json({ ok: true, temporaryPassword });
  }
  if (!body.status || !allowedStatuses.has(body.status)) return Response.json({ error: "올바르지 않은 상태입니다." }, { status: 400 });
  const result = await env.DB.prepare("UPDATE accounts SET status = ? WHERE id = ? AND role = 'artist'").bind(body.status, id).run();
  if (!result.meta.changes) return Response.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });
  return Response.json({ ok: true, status: body.status });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return forbidden();
  const { id } = await context.params;
  const result = await env.DB.prepare("UPDATE accounts SET status = 'deleted' WHERE id = ? AND role = 'artist'").bind(id).run();
  if (!result.meta.changes) return Response.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });
  return Response.json({ ok: true });
}

import { env } from "cloudflare:workers";
import { requireArtist } from "../../../admin/admin-auth";
import { ensureApplicationsTable, linkLegacyApplication } from "../../../applications-db";

export const runtime = "edge";

export async function GET() {
  const user = await requireArtist();
  if (!user) return Response.json({ error: "회원가입 또는 로그인 후 확인해주세요." }, { status: 403 });
  await ensureApplicationsTable();
  const account = await env.DB.prepare("SELECT id, display_name, login_id, phone, email FROM accounts WHERE id = ?")
    .bind(user.accountId).first<{ id: string; display_name: string; login_id: string; phone: string; email: string }>();
  if (account) await linkLegacyApplication({ id: account.id, displayName: account.display_name || account.login_id, phone: account.phone, email: account.email });
  const application = await env.DB.prepare(`SELECT id, status, created_at FROM artist_applications
    WHERE account_id = ? AND status IN ('draft', 'received', 'reviewing', 'hold', 'approved')
    ORDER BY created_at DESC LIMIT 1`).bind(user.accountId).first<{ id: string; status: string; created_at: string }>();
  return Response.json({ application: application || null }, { headers: { "cache-control": "no-store" } });
}

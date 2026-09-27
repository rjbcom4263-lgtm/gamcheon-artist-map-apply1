import { requireArtist } from "../../../admin/admin-auth";
import { ensureApplicationsTable, linkLegacyApplication } from "../../../applications-db";
import { env } from "cloudflare:workers";

export const runtime = "edge";

export async function POST() {
  const user = await requireArtist();
  if (!user) return Response.json({ error: "회원가입 또는 로그인 후 신청해주세요." }, { status: 403 });
  await ensureApplicationsTable();
  const account = await env.DB.prepare("SELECT id, display_name, login_id, phone, email FROM accounts WHERE id = ?")
    .bind(user.accountId).first<{ id: string; display_name: string; login_id: string; phone: string; email: string }>();
  if (account) await linkLegacyApplication({ id: account.id, displayName: account.display_name || account.login_id, phone: account.phone, email: account.email });
  const existing = await env.DB.prepare("SELECT id, status FROM artist_applications WHERE account_id = ? AND status IN ('draft', 'received', 'reviewing', 'hold', 'approved') ORDER BY created_at DESC LIMIT 1")
    .bind(user.accountId).first<{ id: string; status: string }>();
  if (existing?.status === "draft") return Response.json({ id: existing.id });
  if (existing) return Response.json({ error: "이미 접수되었거나 심사 중인 신청이 있습니다.", id: existing.id, status: existing.status }, { status: 409 });
  const id = `GA-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  await env.DB.prepare("INSERT OR IGNORE INTO artist_applications (id, account_id, artist_name, phone, email, status, payload_json, image_keys_json) VALUES (?, ?, ?, '', '', 'draft', '{}', '[]')")
    .bind(id, user.accountId, user.displayName).run();
  const current = await env.DB.prepare("SELECT id, status FROM artist_applications WHERE account_id = ? AND status IN ('draft', 'received', 'reviewing', 'hold', 'approved') ORDER BY created_at DESC LIMIT 1")
    .bind(user.accountId).first<{ id: string; status: string }>();
  if (current?.status === "draft") return Response.json({ id: current.id });
  return Response.json({ error: "이미 접수되었거나 심사 중인 신청이 있습니다.", id: current?.id, status: current?.status }, { status: 409 });
}

import { env } from "cloudflare:workers";
import { requireArtist } from "../../../admin/admin-auth";

export const runtime = "edge";

export async function GET() {
  const user = await requireArtist();
  if (!user) return Response.json({ error: "회원가입 또는 로그인 후 확인해주세요." }, { status: 403 });
  const application = await env.DB.prepare(`SELECT id, status, created_at FROM artist_applications
    WHERE account_id = ? AND status IN ('draft', 'received', 'reviewing', 'hold', 'approved')
    ORDER BY created_at DESC LIMIT 1`).bind(user.accountId).first<{ id: string; status: string; created_at: string }>();
  return Response.json({ application: application || null }, { headers: { "cache-control": "no-store" } });
}

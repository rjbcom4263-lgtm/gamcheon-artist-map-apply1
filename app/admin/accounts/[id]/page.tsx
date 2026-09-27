import { env } from "cloudflare:workers";
import { redirect } from "next/navigation";
import { requireAdmin } from "../../admin-auth";
import type { Account, Application } from "../../AdminDashboard";
import AccountDetail from "./AccountDetail";
import { ensureApplicationsTable } from "../../../applications-db";

export const dynamic = "force-dynamic";

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) redirect("/login");
  const { id } = await params;
  const account = await env.DB.prepare("SELECT id, login_id, role, status, display_name, phone, email, created_at, last_login_at FROM accounts WHERE id = ? AND role = 'artist' AND status != 'deleted'")
    .bind(id).first<Account>();
  if (!account) redirect("/admin");
  await ensureApplicationsTable();
  const application = await env.DB.prepare(`SELECT id, artist_name, phone, email, status, payload_json, image_keys_json, created_at FROM artist_applications
    WHERE account_id = ? OR (account_id = '' AND (phone = ? OR (email != '' AND email = ?) OR artist_name = ?))
    ORDER BY created_at DESC
    LIMIT 1`).bind(account.id, account.phone || "", account.email || "", account.display_name || "").first<Application>();
  return <AccountDetail account={account} application={application || null}/>;
}

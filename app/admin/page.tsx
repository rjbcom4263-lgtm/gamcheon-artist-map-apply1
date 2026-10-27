import { env } from "cloudflare:workers";
import { redirect } from "next/navigation";
import { requireAdmin } from "./admin-auth";
import AdminDashboard, { type Account, type Application } from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const query = await searchParams;

  const result = await env.DB.prepare("SELECT id, artist_name, phone, email, status, payload_json, image_keys_json, created_at FROM artist_applications WHERE status != 'draft' ORDER BY created_at DESC LIMIT 1000").all<Application>();
  const accounts = await env.DB.prepare("SELECT id, login_id, role, status, display_name, phone, email, created_at, last_login_at FROM accounts WHERE role = 'artist' AND status != 'deleted' ORDER BY created_at DESC LIMIT 1000").all<Account>();
  return <AdminDashboard key={query.view === "accounts" ? "accounts" : "applications"} initial={result.results || []} initialAccounts={accounts.results || []} adminName={admin.displayName} initialView={query.view === "accounts" ? "accounts" : "applications"}/>;
}

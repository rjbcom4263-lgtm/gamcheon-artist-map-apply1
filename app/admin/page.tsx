import { env } from "cloudflare:workers";
import { redirect } from "next/navigation";
import { requireAdmin } from "./admin-auth";
import AdminDashboard, { type Account, type ApplicationSummary } from "./AdminDashboard";

export const dynamic = "force-dynamic";

// 목록 화면은 분야만 필요하므로 payload_json 전체 대신 json_extract로 categories만 꺼냅니다.
const APPLICATION_LIST_SQL = `SELECT id, artist_name, phone, email, status, created_at,
    CASE WHEN json_valid(payload_json) THEN json_extract(payload_json, '$.categories') END AS categories_json
  FROM artist_applications WHERE status != 'draft' ORDER BY created_at DESC LIMIT 1000`;

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const query = await searchParams;
  const view = query.view === "accounts" ? "accounts" : "applications";

  const [result, accounts] = await Promise.all([
    env.DB.prepare(APPLICATION_LIST_SQL).all<ApplicationSummary>(),
    env.DB.prepare("SELECT id, login_id, role, status, display_name, phone, email, created_at, last_login_at FROM accounts WHERE role = 'artist' AND status != 'deleted' ORDER BY created_at DESC LIMIT 1000").all<Account>(),
  ]);
  return <AdminDashboard key={view} initial={result.results || []} initialAccounts={accounts.results || []} adminName={admin.displayName} initialView={view}/>;
}

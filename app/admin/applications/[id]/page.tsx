import { env } from "cloudflare:workers";
import { redirect } from "next/navigation";
import { requireAdmin } from "../../admin-auth";
import type { Application } from "../../AdminDashboard";
import ApplicationDetail from "./ApplicationDetail";

export const dynamic = "force-dynamic";

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) redirect("/login");
  const { id } = await params;
  const application = await env.DB.prepare("SELECT id, artist_name, phone, email, status, payload_json, image_keys_json, created_at FROM artist_applications WHERE id = ?").bind(id).first<Application>();
  if (!application) redirect("/admin");
  return <ApplicationDetail application={application}/>;
}

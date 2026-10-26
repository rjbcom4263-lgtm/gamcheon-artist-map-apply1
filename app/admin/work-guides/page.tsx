import { redirect } from "next/navigation";
import { requireAdmin } from "../admin-auth";
import AdminSidebar from "../AdminSidebar";
import AdminWorkGuides from "./AdminWorkGuides";
import "./work-guides.css";

export default async function AdminWorkGuidesPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  return <div className="admin-dashboard admin-guides-shell"><AdminSidebar active="work-guides" adminName={admin.displayName}/><AdminWorkGuides/></div>;
}

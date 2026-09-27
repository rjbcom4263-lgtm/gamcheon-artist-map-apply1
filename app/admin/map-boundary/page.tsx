import { redirect } from "next/navigation";
import { requireAdmin } from "../admin-auth";
import BoundaryEditor from "./BoundaryEditor";
import "./boundary-editor.css";

export const dynamic = "force-dynamic";

export default async function AdminMapBoundaryPage() {
  if (!await requireAdmin()) redirect("/admin/login");
  return <BoundaryEditor />;
}

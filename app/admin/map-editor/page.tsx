import { redirect } from "next/navigation";
import { requireAdmin } from "../admin-auth";
import MapTileEditor from "./MapTileEditor";
import "./map-editor.css";

export const dynamic = "force-dynamic";

export default async function AdminMapEditorPage() {
  if (!await requireAdmin()) redirect("/admin/login");
  return <MapTileEditor />;
}

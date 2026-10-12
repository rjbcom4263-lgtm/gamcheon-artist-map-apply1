import { redirect } from "next/navigation";
import { requireAdmin } from "../admin-auth";
import AdminSidebar from "../AdminSidebar";
import "./map-editor.css";

export const dynamic = "force-dynamic";

// 지도 편집: 감천 골목지도 편집 앱(/map-app/studio/, art-map 저장소에서 npm run export:site로 넣음)을 운영자 화면
// 안에 띄웁니다. 같은 사이트라 운영자 로그인을 그대로 쓰고, 골목길·건물은 이 사이트 데이터베이스에 저장됩니다.
const EDITOR_PATH = "/map-app/studio/";

export default async function AdminMapEditorPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  return <div className="admin-dashboard admin-workshop">
    <AdminSidebar active="map-editor" adminName={admin.displayName}/>
    <main className="admin-workshop-main">
      <header className="admin-workshop-head">
        <div><h1>지도 편집</h1><p>골목길과 건물을 고치고 공개하면 작가 지도(/map)에 나타납니다.</p></div>
        <a href={EDITOR_PATH} target="_blank" rel="noreferrer">새 창으로 열기 ↗</a>
      </header>
      <iframe title="감천 골목지도 편집" src={EDITOR_PATH} allow="geolocation; accelerometer; gyroscope; magnetometer" className="admin-workshop-frame" />
    </main>
  </div>;
}

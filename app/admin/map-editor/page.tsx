import { redirect } from "next/navigation";
import { requireAdmin } from "../admin-auth";
import AdminSidebar from "../AdminSidebar";
import { MAP_APP_ORIGIN } from "../../map/map-app";
import "./map-editor.css";

export const dynamic = "force-dynamic";

// 지도 편집: 별도 지도 앱(gamcheon-alley-map)의 편집 앱(/studio/)을 운영자 화면 안에 띄웁니다.
// 홈페이지는 주소만 알고, 골목길·건물 데이터는 지도 앱 서버가 저장합니다.
export default async function AdminMapEditorPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  return <div className="admin-dashboard admin-workshop">
    <AdminSidebar active="map-editor" adminName={admin.displayName}/>
    <main className="admin-workshop-main">
      <header className="admin-workshop-head">
        <div><h1>지도 편집</h1><p>골목길과 건물을 고치고 공개하면 홈페이지 지도에 나타납니다.</p></div>
        <a href={`${MAP_APP_ORIGIN}/studio/`} target="_blank" rel="noreferrer">새 창으로 열기 ↗</a>
      </header>
      <iframe title="감천 골목지도 편집" src={`${MAP_APP_ORIGIN}/studio/`} allow="geolocation; accelerometer; gyroscope; magnetometer" className="admin-workshop-frame" />
    </main>
  </div>;
}

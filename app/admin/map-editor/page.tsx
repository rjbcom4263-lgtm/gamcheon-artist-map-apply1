import { redirect } from "next/navigation";
import { requireAdmin } from "../admin-auth";
import AdminSidebar from "../AdminSidebar";
import { MAP_APP_ORIGIN } from "../../map/map-app";
import { createMapEditToken } from "./edit-token";
import "./map-editor.css";

export const dynamic = "force-dynamic";

// 지도 편집: 별도 지도 앱(gamcheon-alley-map)의 편집 앱(/studio/)을 운영자 화면 안에 띄웁니다.
// 홈페이지는 주소만 알고, 골목길·건물 데이터는 지도 앱 서버가 저장합니다. 운영자 로그인을 확인한 뒤 8시간짜리
// 편집 허가증을 주소의 # 뒤(서버로 보내지지 않는 부분)에 붙여 넘기므로, 지도 앱에 따로 로그인하지 않습니다.
export default async function AdminMapEditorPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const token = await createMapEditToken(admin.loginId);
  const editorUrl = token ? `${MAP_APP_ORIGIN}/studio/#editToken=${token}` : `${MAP_APP_ORIGIN}/studio/`;

  return <div className="admin-dashboard admin-workshop">
    <AdminSidebar active="map-editor" adminName={admin.displayName}/>
    <main className="admin-workshop-main">
      <header className="admin-workshop-head">
        <div><h1>지도 편집</h1><p>{token ? "골목길과 건물을 고치고 공개하면 홈페이지 지도에 나타납니다. 8시간이 지나면 이 화면을 다시 열어 주세요." : "편집 허가 비밀값(MAP_EDIT_SECRET)이 설정되지 않아 편집할 수 없습니다. 지도 앱 폴더에서 npm run link:homepage를 실행해 주세요."}</p></div>
        <a href={editorUrl} target="_blank" rel="noreferrer">새 창으로 열기 ↗</a>
      </header>
      <iframe title="감천 골목지도 편집" src={editorUrl} allow="geolocation; accelerometer; gyroscope; magnetometer" className="admin-workshop-frame" />
    </main>
  </div>;
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "../admin-auth";
import AdminSidebar from "../AdminSidebar";
import "./art-map.css";

export const dynamic = "force-dynamic";

// Bundled from https://github.com/InSeok211/art-map at cf12dc1.
const mapDocument = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>감천 골목지도</title>
  <link rel="stylesheet" href="/admin-art-map/assets/map.css" />
  <script type="module" src="/admin-art-map/assets/map.js"></script>
</head>
<body><div id="root"></div></body>
</html>`;

export default async function AdminArtMapPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  return <div className="admin-dashboard admin-workshop">
    <AdminSidebar active="art-map" adminName={admin.displayName}/>
    <main className="admin-workshop-main">
      <header className="admin-workshop-head">
        <div><h1>골목지도 작업실</h1><p>골목길을 직접 그리거나 걸으며 기록해 찾습니다. 저장한 골목길은 공개 지도에 바로 나타납니다.</p></div>
        <Link href="/map" target="_blank">공개 지도 보기 ↗</Link>
      </header>
      {/* 휴대폰에서 걸으며 GPS를 기록하므로 위치 권한을 넘겨 줍니다(같은 출처의 문서). */}
      <iframe title="감천 골목지도 작업실" srcDoc={mapDocument} allow="geolocation" className="admin-workshop-frame" />
    </main>
  </div>;
}

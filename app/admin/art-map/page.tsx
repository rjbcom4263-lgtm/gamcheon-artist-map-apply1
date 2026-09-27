import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "../admin-auth";

export const dynamic = "force-dynamic";

// Bundled from https://github.com/InSeok211/art-map at ee8a08c.
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
  if (!await requireAdmin()) redirect("/admin/login");

  return <main style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "#f4f5f7" }}>
    <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 24px" }}>
      <div><h1 style={{ margin: 0, fontSize: 22 }}>골목지도 작업실</h1><p style={{ margin: "5px 0 0", fontSize: 14 }}>장소·골목길·3D 모델을 편집할 수 있습니다. 현재 편집 내용은 이 브라우저에만 저장됩니다. 공개 지도와 연결되지 않습니다.</p></div>
      <Link href="/admin/map" style={{ color: "#245f55", fontWeight: 700 }}>지도 관리로 돌아가기</Link>
    </header>
    <iframe title="감천 골목지도 편집" srcDoc={mapDocument} style={{ display: "block", flex: 1, width: "100%", minHeight: 650, border: 0 }} />
  </main>;
}

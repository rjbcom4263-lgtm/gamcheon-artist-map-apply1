import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "../admin-auth";
import AdminSidebar from "../AdminSidebar";
import "./map-management.css";

export const dynamic = "force-dynamic";

const tools = [
  { title: "작가 위치·공개", href: "/admin/artists", icon: "⌖", text: "승인한 작가의 공방 위치를 지도에서 지정하고, 공개 지도에 보일지 정합니다." },
  { title: "골목지도 작업실", href: "/admin/art-map", icon: "⌁", text: "골목길을 직접 그리거나, 휴대폰으로 걸으며 남긴 GPS 기록에서 지도에 없는 골목길을 찾아 추가합니다." },
];

export default async function AdminMapManagementPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  return <div className="admin-dashboard">
    <AdminSidebar active="map" adminName={admin.displayName}/>
    <main className="dash-main">
      <header className="dash-top">
        <div><p>GAMCHEON ARTIST MAP</p><h1>지도 관리</h1></div>
        <div className="dash-actions"><Link href="/map" target="_blank">공개 지도 보기</Link></div>
      </header>
      <section className="map-tool-grid">{tools.map((tool) => <Link className="dash-card map-tool-card" key={tool.href} href={tool.href}>
        <span className="map-tool-icon" aria-hidden="true">{tool.icon}</span>
        <h2>{tool.title}</h2>
        <p>{tool.text}</p>
        <div><em>공개 지도에 바로 반영</em><b>열기 →</b></div>
      </Link>)}</section>
    </main>
  </div>;
}

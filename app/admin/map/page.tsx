import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "../admin-auth";
import "./map-management.css";

export const dynamic = "force-dynamic";

const tools = [
  { number: "01", title: "작가 위치 공개", href: "/admin/artists", group: "작가 정보", text: "승인 작가를 공개하고 지도에서 위치를 지정합니다.", status: "운영 중", live: true },
  { number: "02", title: "지도 구역 경계", href: "/admin/map-boundary", group: "구역 만들기", text: "OSM 골목길과 주요 시설을 보며 지도 외곽선을 그립니다.", status: "경계 저장 준비", live: false },
  { number: "03", title: "지도 타일 편집", href: "/admin/map-editor", group: "지도 모양", text: "캡처 타일을 저장하거나 AI 스타일로 바꿉니다. 경계 지정과는 별도 기능입니다.", status: "편집 도구", live: false },
  { number: "04", title: "골목지도 작업실", href: "/admin/art-map", group: "실험 도구", text: "장소·골목·3D 모델을 시험 편집합니다. 현재 이 브라우저에만 저장되며 공개 지도와 연결되지 않습니다.", status: "브라우저 전용", live: false },
];

export default async function AdminMapManagementPage() {
  if (!await requireAdmin()) redirect("/admin/login");
  return <main className="map-management-page">
    <header><div><p>GAMCHEON ARTIST MAP</p><h1>지도 관리</h1><span>기능을 골라 하나씩 정리하고 연결합니다.</span></div><Link href="/admin">운영자 홈</Link></header>
    <section className="map-management-note"><strong>현재 순서</strong><span>먼저 공개 구역의 경계를 정합니다. 저장 후 공개 지도에 경계를 적용하는 작업은 다음 단계입니다.</span></section>
    <section className="map-management-grid">{tools.map((tool) => <Link className="map-management-card" key={tool.href} href={tool.href}>
      <div className="map-management-card-top"><span>{tool.number} · {tool.group}</span><em className={tool.live ? "is-live" : ""}>{tool.status}</em></div>
      <h2>{tool.title}</h2><p>{tool.text}</p><b>열기 <span aria-hidden="true">→</span></b>
    </Link>)}</section>
  </main>;
}

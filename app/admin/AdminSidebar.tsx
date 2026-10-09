import Link from "next/link";

// 모든 운영자 화면이 함께 쓰는 왼쪽 메뉴입니다. 화면마다 따로 만들던 메뉴를 하나로 모아, 어느 화면에서든
// 같은 자리에서 같은 메뉴로 오갈 수 있게 합니다. (좁은 화면에서는 위쪽 가로 메뉴가 됩니다.)
export type AdminSection = "applications" | "accounts" | "map" | "artists" | "art-map";

const GROUPS: { title: string; items: { key: AdminSection; label: string; href: string; icon: string }[] }[] = [
  { title: "작가 관리", items: [
    { key: "applications", label: "신청 목록", href: "/admin", icon: "◆" },
    { key: "accounts", label: "작가 계정", href: "/admin?view=accounts", icon: "●" },
  ] },
  { title: "지도 관리", items: [
    { key: "map", label: "지도 관리 홈", href: "/admin/map", icon: "◇" },
    { key: "artists", label: "작가 위치·공개", href: "/admin/artists", icon: "⌖" },
    { key: "art-map", label: "골목지도 작업실", href: "/admin/art-map", icon: "⌁" },
  ] },
];

export default function AdminSidebar({ active, adminName = "운영자" }: { active: AdminSection; adminName?: string }) {
  return <aside className="dash-sidebar">
    <Link href="/" className="dash-logo"><span>감</span><strong>감천 작가 지도</strong></Link>
    <nav aria-label="운영자 메뉴">
      {GROUPS.map((group) => <div className="nav-group" key={group.title}>
        <p>{group.title}</p>
        {group.items.map((item) => <Link key={item.key} className={`sidebar-link${active === item.key ? " active" : ""}`} href={item.href} aria-current={active === item.key ? "page" : undefined}>
          <span aria-hidden="true">{item.icon}</span>{item.label}
        </Link>)}
      </div>)}
      <div className="nav-group"><p>바로가기</p><Link className="sidebar-link" href="/map" target="_blank"><span aria-hidden="true">↗</span>공개 지도 보기</Link></div>
    </nav>
    <div className="dash-sidebar-card"><strong>{adminName}</strong><span>운영자 계정</span><a href="/api/admin/logout">로그아웃</a></div>
  </aside>;
}

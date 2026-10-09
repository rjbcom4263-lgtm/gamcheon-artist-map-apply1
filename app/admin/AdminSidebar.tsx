"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import "./admin-layout.css";

// 모든 운영자 화면이 함께 쓰는 왼쪽 메뉴입니다. 화면마다 따로 만들던 메뉴를 하나로 모아, 어느 화면에서든
// 같은 자리에서 같은 메뉴로 오갈 수 있게 합니다. (좁은 화면에서는 위쪽 가로 메뉴가 됩니다.)
export type AdminSection = "applications" | "accounts" | "artists" | "art-map";

const GROUPS: { title: string; items: { key: AdminSection; label: string; href: string; icon: string }[] }[] = [
  { title: "작가 관리", items: [
    { key: "applications", label: "신청 목록", href: "/admin", icon: "◆" },
    { key: "accounts", label: "작가 계정", href: "/admin?view=accounts", icon: "●" },
  ] },
  { title: "지도 관리", items: [
    { key: "artists", label: "작가 위치·공개", href: "/admin/artists", icon: "⌖" },
    { key: "art-map", label: "골목지도 작업실", href: "/admin/art-map", icon: "⌁" },
  ] },
];

export default function AdminSidebar({ active, adminName = "운영자" }: { active: AdminSection; adminName?: string }) {
  const asideRef = useRef<HTMLElement>(null);
  // 좁은 화면의 가로 메뉴에서 지금 화면 항목이 보이도록 그 자리로 밀어 둡니다.
  useEffect(() => {
    const aside = asideRef.current;
    const current = aside?.querySelector<HTMLElement>(".sidebar-link.active");
    if (aside && current && aside.scrollWidth > aside.clientWidth) aside.scrollLeft = current.offsetLeft - (aside.clientWidth - current.offsetWidth) / 2;
  }, [active]);
  return <aside ref={asideRef} className="dash-sidebar">
    <Link href="/" className="dash-logo"><span>감</span><strong>감천 작가 지도</strong></Link>
    <nav aria-label="운영자 메뉴">
      {GROUPS.map((group) => <div className="nav-group" key={group.title}>
        <p>{group.title}</p>
        {group.items.map((item) => <Link key={item.key} className={`sidebar-link${active === item.key ? " active" : ""}`} href={item.href} aria-current={active === item.key ? "page" : undefined}>
          <span aria-hidden="true">{item.icon}</span>{item.label}
        </Link>)}
      </div>)}
      <div className="nav-group"><p>바로가기</p><Link className="sidebar-link" href="/map" target="_blank"><span aria-hidden="true">↗</span>공개 지도 보기</Link>
        {/* 좁은 화면에서는 아래 계정 카드가 숨으므로 메뉴 끝에 로그아웃을 둡니다. */}
        <a className="sidebar-link sidebar-logout" href="/api/admin/logout">로그아웃</a></div>
    </nav>
    <div className="dash-sidebar-card"><strong>{adminName}</strong><span>운영자 계정</span><a href="/api/admin/logout">로그아웃</a></div>
  </aside>;
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type Application = { id: string; artist_name: string; phone: string; email: string; status: string; payload_json: string; image_keys_json: string; created_at: string };
export type Account = { id: string; login_id: string; role: string; status: string; display_name: string; phone: string; email: string; created_at: string; last_login_at: string | null };
type Payload = { categories?: string[] };
type View = "applications" | "accounts";

const STATUS = { received: "접수", reviewing: "검토 중", approved: "승인", hold: "보류", rejected: "반려", cancelled: "신청자 취소" } as const;
const ACCOUNT_STATUS = { pending: "승인 대기", active: "활성", suspended: "정지", deleted: "삭제됨" } as const;

function parse<T>(value: string, fallback: T): T { try { return JSON.parse(value) as T; } catch { return fallback; } }
function date(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value + (value.endsWith("Z") ? "" : "Z")));
}

export default function AdminDashboard({ initial, initialAccounts, adminName, initialView = "applications" }: { initial: Application[]; initialAccounts: Account[]; adminName: string; initialView?: View }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState<View>(initialView);

  const filtered = useMemo(() => initial.filter((row) => {
    const matchesStatus = filter === "all" || row.status === filter;
    const needle = query.trim().toLowerCase();
    const matchesQuery = !needle || `${row.artist_name} ${row.phone} ${row.email} ${row.id}`.toLowerCase().includes(needle);
    return matchesStatus && matchesQuery;
  }), [initial, filter, query]);
  const counts = useMemo(() => ({
    all: initial.length,
    received: initial.filter((x) => x.status === "received").length,
    approved: initial.filter((x) => x.status === "approved").length,
    pendingAccounts: initialAccounts.filter((x) => x.status === "pending").length,
  }), [initial, initialAccounts]);

  return <div className="admin-dashboard">
    <aside className="dash-sidebar">
      <Link href="/" className="dash-logo"><span>감</span><strong>감천 작가 지도</strong></Link>
      <nav>
        <div className="nav-group"><p>신청 관리</p><button className={view === "applications" ? "active" : ""} onClick={() => setView("applications")}><span>◆</span>신청 목록</button></div>
        <button className={view === "accounts" ? "active" : ""} onClick={() => setView("accounts")}><span>●</span>계정 관리</button>
        <div className="nav-group"><p>지도 관리</p><Link className="sidebar-link" href="/admin/map"><span>◇</span>지도 관리 홈</Link><Link className="sidebar-link" href="/admin/artists"><span>◆</span>공개 작가 관리</Link></div>
      </nav>
      <div className="dash-sidebar-card"><strong>{adminName}</strong><span>운영자 계정</span><a href="/api/admin/logout">로그아웃</a></div>
    </aside>
    <main className="dash-main">
      <header className="dash-top">
        <div><p>GAMCHEON ARTIST MAP</p><h1>{view === "applications" ? "작가 신청 관리" : "회원가입 계정 관리"}</h1></div>
        <div className="dash-actions"><Link href="/admin/map">지도 관리</Link><Link href="/api/admin/applications/export">CSV 다운로드</Link><Link href="/apply">신청 화면</Link></div>
      </header>
      <section className="dash-metrics">
        <Metric label="전체 신청" value={counts.all}/><Metric label="신규 접수" value={counts.received}/><Metric label="승인 완료" value={counts.approved}/><Metric label="승인 대기 계정" value={counts.pendingAccounts}/>
      </section>
      {view === "applications" ? <section className="dash-card dash-table-card admin-list-wide">
        <div className="dash-card-head">
          <div><h2>신청 목록</h2><span>신청서를 누르면 새 상세 페이지에서 운영자 처리를 진행합니다.</span></div>
          <div className="dash-filters"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="작가명, 연락처, 접수번호"/><select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">전체</option>{Object.entries(STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        </div>
        <div className="application-table">
          <div className="table-row table-head"><span>작가</span><span>분야</span><span>상태</span><span>접수일</span><span>상세</span></div>
          {filtered.length ? filtered.map((row) => <Link key={row.id} className="table-row" href={`/admin/applications/${encodeURIComponent(row.id)}`}>
            <span><strong>{row.artist_name}</strong><small>{row.id}</small></span>
            <span>{parse<Payload>(row.payload_json, {}).categories?.join(" · ") || "분야 미입력"}</span>
            <span><em className={`status status-${row.status}`}>{STATUS[row.status as keyof typeof STATUS] || row.status}</em></span>
            <span>{date(row.created_at)}</span>
            <span><b className="open-detail">열기</b></span>
          </Link>) : <div className="admin-empty">조건에 맞는 신청서가 없습니다.</div>}
        </div>
      </section> : <section className="dash-card accounts-card account-list-page">
          <div className="dash-card-head"><div><h2>작가 계정</h2><span>계정을 누르면 새 상세 페이지에서 프로필과 지도 카드 미리보기, 계정 처리를 확인합니다.</span></div><strong>{initialAccounts.length}개 계정</strong></div>
          <div className="account-table">
            <div className="account-row account-head"><span>아이디</span><span>작가명</span><span>연락처</span><span>상태</span><span>가입일</span><span>상세</span></div>
            {initialAccounts.length ? initialAccounts.map((account) => <Link className="account-row account-row-link" key={account.id} href={`/admin/accounts/${encodeURIComponent(account.id)}`}>
              <span><strong>{account.login_id}</strong><small>{account.email || "이메일 없음"}</small></span><span>{account.display_name || "-"}</span><span>{account.phone || "-"}</span>
              <span><em className={`account-badge account-${account.status}`}>{ACCOUNT_STATUS[account.status as keyof typeof ACCOUNT_STATUS] || account.status}</em></span><span>{date(account.created_at)}</span>
              <span><b className="open-detail">열기</b></span>
            </Link>) : <div className="admin-empty">회원가입한 작가 계정이 없습니다.</div>}
          </div>
      </section>}
    </main>
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="metric-card"><span>{label}</span><strong>{value}</strong></div>; }

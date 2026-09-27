"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Account, Application } from "../../AdminDashboard";

type Work = { id?: string; title?: string; status?: string; description?: string };
type Payload = { values?: Record<string, string | boolean>; categories?: string[]; works?: Work[] };
type ImageRecord = { type: string; workIndex?: number; key: string; name?: string };

const ACCOUNT_STATUS = { pending: "승인 대기", active: "활성", suspended: "정지", deleted: "삭제됨" } as const;
const STATUS = { received: "접수", reviewing: "검토 중", approved: "승인", hold: "보류", rejected: "반려", cancelled: "신청자 취소" } as const;

function parse<T>(value: string, fallback: T): T { try { return JSON.parse(value) as T; } catch { return fallback; } }
function date(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value + (value.endsWith("Z") ? "" : "Z")));
}

export default function AccountDetail({ account, application }: { account: Account; application: Application | null }) {
  const router = useRouter();
  const [row, setRow] = useState(account);
  const [saving, setSaving] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const payload = application ? parse<Payload>(application.payload_json, {}) : {};
  const images = application ? parse<ImageRecord[]>(application.image_keys_json, []) : [];
  const profileImage = images.find((image) => image.type === "profile");
  const works = payload.works || [];

  async function changeStatus(status: string) {
    setSaving(true);
    const response = await fetch(`/api/admin/accounts/${encodeURIComponent(row.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    setSaving(false);
    if (!response.ok) return alert("계정 상태를 변경하지 못했습니다.");
    setRow((current) => ({ ...current, status }));
  }

  async function resetPassword() {
    if (!confirm(`${row.display_name || row.login_id} 비밀번호를 1234로 초기화할까요?`)) return;
    setSaving(true);
    const response = await fetch(`/api/admin/accounts/${encodeURIComponent(row.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ resetPassword: true }) });
    const result = await response.json().catch(() => ({})) as { temporaryPassword?: string; error?: string };
    setSaving(false);
    if (!response.ok || !result.temporaryPassword) return alert(result.error || "비밀번호를 초기화하지 못했습니다.");
    setTemporaryPassword(result.temporaryPassword);
  }

  async function promoteAdmin() {
    if (!confirm(`${row.display_name || row.login_id} 계정을 관리자 권한으로 승격할까요? 로그인과 전체 관리자 기능을 사용할 수 있게 됩니다.`)) return;
    setSaving(true);
    const response = await fetch(`/api/admin/accounts/${encodeURIComponent(row.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ promoteAdmin: true }) });
    const result = await response.json().catch(() => ({})) as { error?: string };
    setSaving(false);
    if (!response.ok) return alert(result.error || "관리자 승격에 실패했습니다.");
    router.replace("/admin");
    router.refresh();
  }

  async function deleteAccount() {
    if (!confirm(`${row.display_name || row.login_id} 계정을 삭제할까요?`)) return;
    setSaving(true);
    const response = await fetch(`/api/admin/accounts/${encodeURIComponent(row.id)}`, { method: "DELETE" });
    setSaving(false);
    if (!response.ok) return alert("계정을 삭제하지 못했습니다.");
    router.replace("/admin");
    router.refresh();
  }

  return <div className="admin-dashboard">
    <aside className="dash-sidebar">
      <Link href="/" className="dash-logo"><span>감</span><strong>감천 작가 지도</strong></Link>
      <nav>
        <div className="nav-group"><p>신청 관리</p><Link className="sidebar-link" href="/admin"><span>◆</span>신청 목록</Link></div>
        <div className="nav-group"><p>계정 관리</p><Link className="sidebar-link active" href="/admin"><span>●</span>계정 목록</Link></div>
      </nav>
      <div className="dash-sidebar-card"><strong>운영자</strong><span>작가 계정 상세</span><a href="/api/admin/logout">로그아웃</a></div>
    </aside>
    <main className="dash-main account-detail-page">
      <header className="dash-top">
        <div><p>{row.login_id}</p><h1>{row.display_name || row.login_id}</h1></div>
        <div className="dash-actions"><Link href="/admin">목록으로</Link><Link href={`/artist?account=${encodeURIComponent(row.id)}`} target="_blank">작가 페이지 보기</Link><Link href="/apply">신청 화면</Link></div>
      </header>
      <section className="detail-page-grid">
        <div className="dash-card detail-main-card">
          <DetailSection title="계정 정보"><Info label="아이디" value={row.login_id}/><Info label="작가명" value={row.display_name || "-"}/><Info label="휴대전화" value={row.phone || "-"}/><Info label="이메일" value={row.email || "-"}/><Info label="가입일" value={date(row.created_at)}/><Info label="최근 로그인" value={date(row.last_login_at)}/></DetailSection>
          {application ? <>
            <DetailSection title="연결된 신청서"><Info label="접수번호" value={application.id}/><Info label="신청 상태" value={STATUS[application.status as keyof typeof STATUS] || application.status}/><Info label="분야" value={payload.categories?.join(", ") || "-"}/><Info label="한 줄 소개" value={String(payload.values?.tagline || "-")}/></DetailSection>
            <DetailSection title="지도 카드 미리보기" wide>
              <div className="map-preview-card account-detail-map-card">
                {profileImage ? <img src={`/api/admin/images?key=${encodeURIComponent(profileImage.key)}`} alt="지도 카드 대표 이미지"/> : <div className="map-preview-empty">대표 이미지 없음</div>}
                <div><span>{payload.categories?.join(" · ") || "분야 미입력"}</span><h3>{application.artist_name}</h3><p>{String(payload.values?.tagline || "한 줄 소개가 없습니다.")}</p></div>
              </div>
            </DetailSection>
            <DetailSection title={`대표 작품 ${works.length}점`} wide>
              <div className="preview-work-list account-detail-work-list">
                {works.slice(0, 5).map((work, index) => {
                  const image = images.find((item) => item.type === "work" && item.workIndex === index);
                  return <div key={work.id || index}>{image ? <img src={`/api/admin/images?key=${encodeURIComponent(image.key)}`} alt={`${work.title || "작품"} 이미지`}/> : <span/>}<strong>{index + 1}. {work.title || "작품명 없음"}</strong></div>;
                })}
              </div>
            </DetailSection>
          </> : <section className="detail-section"><h3>연결된 신청서</h3><div className="admin-empty compact">아직 이 계정과 연결된 신청서가 없습니다.</div></section>}
        </div>
        <aside className="dash-card process-card">
          <div className="detail-title"><div><span>계정 상태</span><h2>{ACCOUNT_STATUS[row.status as keyof typeof ACCOUNT_STATUS] || row.status}</h2></div><select value={row.status} disabled={saving} onChange={(event) => changeStatus(event.target.value)}><option value="pending">승인 대기</option><option value="active">활성</option><option value="suspended">정지</option></select></div>
          <section className="review-panel"><div><strong>계정 처리</strong><span>로그인 도움과 계정 상태를 관리합니다.</span></div><div className="review-actions"><button disabled={saving} onClick={() => changeStatus("active")}>활성</button><button disabled={saving} onClick={() => changeStatus("suspended")}>정지</button><button disabled={saving} onClick={resetPassword}>비번 1234</button><button className="delete" disabled={saving} onClick={deleteAccount}>삭제</button></div>{temporaryPassword && <small>임시 비밀번호: {temporaryPassword}</small>}</section>
          <section className="review-panel promote-admin-panel"><div><strong>관리자 권한</strong><span>이 계정에 운영자 전체 권한을 부여합니다.</span></div><div className="review-actions"><button className="promote-admin-button" disabled={saving} onClick={promoteAdmin}>{saving ? "처리 중…" : "관리자로 승격"}</button></div></section>
          {application && <section className="review-panel"><div><strong>신청서</strong><span>작가 신청 상세로 이동합니다.</span></div><div className="review-actions"><Link className="review-link-button" href={`/admin/applications/${encodeURIComponent(application.id)}`}>신청서 열기</Link></div></section>}
        </aside>
      </section>
    </main>
  </div>;
}

function DetailSection({ title, children, wide = false }: { title: string; children: React.ReactNode; wide?: boolean }) { return <section className={`detail-section ${wide ? "wide" : ""}`}><h3>{title}</h3><div className="detail-grid">{children}</div></section>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="detail-info"><span>{label}</span><p>{value}</p></div>; }

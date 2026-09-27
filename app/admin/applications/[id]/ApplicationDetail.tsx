"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Application } from "../../AdminDashboard";

type Work = { id?: string; title?: string; status?: string; description?: string };
type Payload = { values?: Record<string, string | boolean>; categories?: string[]; works?: Work[]; adminReview?: { note?: string; processedAt?: string; status?: string } };
type ImageRecord = { type: string; workIndex?: number; key: string; name: string };

const STATUS = { received: "접수", reviewing: "검토 중", approved: "승인", hold: "보류", rejected: "반려", cancelled: "신청자 취소" } as const;

function parse<T>(value: string, fallback: T): T { try { return JSON.parse(value) as T; } catch { return fallback; } }
function date(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value + (value.endsWith("Z") ? "" : "Z")));
}

export default function ApplicationDetail({ application }: { application: Application }) {
  const router = useRouter();
  const [row, setRow] = useState(application);
  const [saving, setSaving] = useState(false);
  const payload = parse<Payload>(row.payload_json, {});
  const images = parse<ImageRecord[]>(row.image_keys_json, []);
  const values = payload.values || {};
  const [reviewNote, setReviewNote] = useState(payload.adminReview?.note || "");

  async function changeStatus(status: string) {
    if ((status === "rejected" || status === "cancelled") && !reviewNote.trim()) return alert("처리 사유를 입력해주세요.");
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/applications/${encodeURIComponent(row.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, reviewNote }) });
      if (!response.ok) throw new Error("상태를 저장하지 못했습니다.");
      const result = await response.json();
      setRow((current) => ({ ...current, status, payload_json: result.payload_json }));
      if (status === "approved") router.push(`/admin/artists?artist=${encodeURIComponent(row.id)}`);
    } catch {
      alert("상태를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteApplication() {
    if (!confirm(`${row.artist_name} 신청서를 삭제할까요?\n연결된 이미지 파일도 함께 삭제됩니다.`)) return;
    setSaving(true);
    const response = await fetch(`/api/admin/applications/${encodeURIComponent(row.id)}`, { method: "DELETE" });
    setSaving(false);
    if (!response.ok) return alert("신청서를 삭제하지 못했습니다.");
    router.replace("/admin");
    router.refresh();
  }

  return <div className="admin-dashboard">
    <aside className="dash-sidebar">
      <Link href="/" className="dash-logo"><span>감</span><strong>감천 작가 지도</strong></Link>
      <nav>
        <div className="nav-group"><p>신청 관리</p><Link className="sidebar-link active" href="/admin"><span>◆</span>신청 목록</Link></div>
        <div className="nav-group"><p>계정 관리</p><Link className="sidebar-link" href="/admin"><span>●</span>계정 목록</Link></div>
      </nav>
      <div className="dash-sidebar-card"><strong>운영자</strong><span>신청서 상세</span><a href="/api/admin/logout">로그아웃</a></div>
    </aside>
    <main className="dash-main application-detail-page">
      <header className="dash-top">
        <div><p>{row.id}</p><h1>{row.artist_name}</h1></div>
        <div className="dash-actions">{row.status === "approved" && <Link href={`/admin/artists?artist=${encodeURIComponent(row.id)}`}>지도에 배치하기</Link>}<Link href="/admin">목록으로</Link><Link href="/apply">신청 화면</Link></div>
      </header>
      <section className="detail-page-grid">
        <div className="dash-card detail-main-card">
          <DetailSection title="기본 정보"><Info label="작가명" value={row.artist_name}/><Info label="한 줄 소개" value={String(values.tagline || "-")}/><Info label="작품 분야" value={payload.categories?.join(", ") || "-"}/><Info label="작가 소개" value={String(values.introduction || values.bio || "-")}/></DetailSection>
          <DetailSection title="연락 및 공방"><Info label="휴대전화" value={row.phone}/><Info label="이메일" value={row.email || "-"}/><Info label="공방명" value={String(values.studioName || "-")}/><Info label="주소" value={String(values.address || values.studioAddress || "-")}/><Info label="온라인 채널" value={String(values.onlineChannel || values.instagram || values.website || "-")}/><Info label="방문 방식" value={String(values.visitType || "-")}/></DetailSection>
          <DetailSection title={`대표 작품 ${payload.works?.length || 0}점`} wide>{payload.works?.map((work, index) => <article className="admin-work" key={work.id || index}><div><strong>{index + 1}. {work.title || "작품명 없음"}</strong><span>{work.status || ""}</span></div><p>{work.description || "작품 설명이 없습니다."}</p>{images.find((x) => x.type === "work" && x.workIndex === index) && <img src={`/api/admin/images?key=${encodeURIComponent(images.find((x) => x.type === "work" && x.workIndex === index)!.key)}`} alt={`${work.title || "대표 작품"} 이미지`}/>}</article>) || <p>-</p>}</DetailSection>
          {images.some((x) => x.type === "profile") && <DetailSection title="작가 프로필 사진" wide><img className="profile-admin-image" src={`/api/admin/images?key=${encodeURIComponent(images.find((x) => x.type === "profile")!.key)}`} alt="작가 프로필"/></DetailSection>}
        </div>
        <aside className="dash-card process-card">
          <div className="detail-title"><div><span>현재 상태</span><h2>{STATUS[row.status as keyof typeof STATUS] || row.status}</h2></div><select value={row.status} disabled={saving} onChange={(e) => changeStatus(e.target.value)}>{Object.entries(STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
          <section className="review-panel"><div><strong>운영자 처리</strong><span>반려·취소 시 사유를 기록합니다.</span></div><textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="처리 사유 또는 내부 메모"/><div className="review-actions"><button disabled={saving} onClick={() => changeStatus("received")}>접수</button><button disabled={saving} onClick={() => changeStatus("approved")}>승인</button><button className="reject" disabled={saving} onClick={() => changeStatus("rejected")}>반려</button><button className="delete" disabled={saving} onClick={deleteApplication}>삭제</button></div>{payload.adminReview?.processedAt && <small>최근 처리: {date(payload.adminReview.processedAt)}</small>}</section>
        </aside>
      </section>
    </main>
  </div>;
}

function DetailSection({ title, children, wide = false }: { title: string; children: React.ReactNode; wide?: boolean }) { return <section className={`detail-section ${wide ? "wide" : ""}`}><h3>{title}</h3><div className="detail-grid">{children}</div></section>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="detail-info"><span>{label}</span><p>{value}</p></div>; }

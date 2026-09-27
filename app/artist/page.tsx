/* eslint-disable @next/next/no-img-element -- vinext's next/image shim is not used for authenticated R2 images. */
import { env } from "cloudflare:workers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "../admin/admin-auth";
import { artistRowToProfile } from "../artists/public-artist";
import PasswordChangeForm from "./PasswordChangeForm";
import ProfileEditForm from "./ProfileEditForm";
import { EDITABLE_APPLICATION_QUERY, PROFILE_EDITOR_ID, profileEditorControl } from "./profile-editor-controls";
import { ensureApplicationsTable, linkLegacyApplication } from "../applications-db";

export const dynamic = "force-dynamic";

type Account = { id: string; login_id: string; status: string; display_name: string; phone: string; email: string; created_at: string; last_login_at: string | null };
type Application = { id: string; artist_name: string; phone: string; email: string; status: string; payload_json: string; image_keys_json: string; created_at: string };
type Work = { id?: string; title?: string; status?: string; description?: string };
type Payload = { values?: Record<string, string | boolean>; categories?: string[]; works?: Work[]; adminReview?: { note?: string; processedAt?: string; status?: string } };
type ImageRecord = { type: string; workIndex?: number; key: string; name: string; contentType?: string };

const STATUS = { draft: "작성 중", received: "접수", reviewing: "검토 중", approved: "승인", hold: "보류", rejected: "반려", cancelled: "신청자 취소" } as const;
const ACCOUNT_STATUS = { pending: "승인 대기", active: "활성", suspended: "정지", deleted: "삭제됨" } as const;

function parse<T>(value: string, fallback: T): T { try { return JSON.parse(value) as T; } catch { return fallback; } }
function date(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value + (value.endsWith("Z") ? "" : "Z")));
}

export default async function ArtistPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const viewer = await requireSession();
  if (!viewer) redirect("/login");
  const query = await searchParams;
  const isAdmin = viewer.role === "admin";
  const accountId = isAdmin ? query.account : viewer.accountId;
  if (!accountId) redirect("/admin");

  const account = await env.DB.prepare("SELECT id, login_id, status, display_name, phone, email, created_at, last_login_at FROM accounts WHERE id = ?")
    .bind(accountId).first<Account>();
  if (!account) redirect(isAdmin ? "/admin" : "/login");
  await ensureApplicationsTable();
  const name = account.display_name || account.login_id;
  const phone = account?.phone || "";
  const email = account?.email || "";
  if (!isAdmin) await linkLegacyApplication({ id: account.id, displayName: name, phone, email });
  const applicationsQuery = env.DB.prepare(`SELECT id, artist_name, phone, email, status, payload_json, image_keys_json, created_at
    FROM artist_applications
    WHERE account_id = ?
    ORDER BY created_at DESC
    LIMIT 5`).bind(accountId).all<Application>();
  const editableQuery = isAdmin ? Promise.resolve(null) : env.DB.prepare(EDITABLE_APPLICATION_QUERY).bind(accountId).first<Application>();
  const [result, editableApplication] = await Promise.all([applicationsQuery, editableQuery]);
  const applications = result.results || [];
  const current = applications[0];
  const payload = current ? parse<Payload>(current.payload_json, {}) : {};
  const images = current ? parse<ImageRecord[]>(current.image_keys_json, []) : [];
  const values = payload.values || {};
  const works = payload.works || [];
  const profile = images.find((image) => image.type === "profile");
  const accountState = ACCOUNT_STATUS[(account?.status || "pending") as keyof typeof ACCOUNT_STATUS] || account?.status || "승인 대기";
  const applicationState = current ? STATUS[current.status as keyof typeof STATUS] || current.status : "신청 없음";
  const imageApi = isAdmin ? "/api/admin/images" : "/api/artist/images";
  const accountUrl = `/admin/accounts/${encodeURIComponent(account.id)}`;
  const editablePayload = editableApplication ? parse<Payload>(editableApplication.payload_json, {}) : {};
  const publicArtist = editableApplication ? artistRowToProfile(editableApplication, true) : null;
  const canEdit = !!editableApplication && !!publicArtist;

  return <main className="artist-shell">
    <aside className="artist-sidebar">
      <Link className="artist-brand" href="/">GAMCHEON ARTISTS<small>LOCAL ARTS AGENCY</small></Link>
      <div className="artist-sidebar-user"><span>{isAdmin ? "ADMIN PREVIEW" : "ARTIST STUDIO"}</span><strong>{name}</strong><small>@{account.login_id}</small></div>
      <nav aria-label="작가 페이지 메뉴">
        <a className="active" href="#dashboard"><b>01</b>대시보드</a>
        <a href="#profile"><b>02</b>프로필</a>
        <a href="#artworks"><b>03</b>대표 작품</a>
        {canEdit && <button {...profileEditorControl("show")}><b>04</b>공개 정보 수정</button>}
        <a href="#channels"><b>{canEdit ? "05" : "04"}</b>방문·채널</a>
        <a href="#account"><b>{canEdit ? "06" : "05"}</b>계정 관리</a>
      </nav>
      <div className="artist-sidebar-foot">{isAdmin && <Link href={accountUrl}>관리자 화면으로 ↗</Link>}<Link href="/">프로젝트 홈 ↗</Link><a href={isAdmin ? "/api/admin/logout" : "/api/auth/logout"}>로그아웃</a></div>
    </aside>

    <div className="artist-stage">
      <header className="artist-topbar"><div><span>{isAdmin ? "ADMIN PREVIEW" : "ARTIST STUDIO"}</span><strong>{isAdmin ? "작가 페이지 미리보기" : "작가 관리 페이지"}</strong></div><div>{isAdmin ? <Link href={accountUrl}>계정 관리</Link> : canEdit ? <button {...profileEditorControl("show")}>공개 정보 수정</button> : <Link href="/apply">정보 변경 신청</Link>}<span className="artist-account-dot"/> {name}</div></header>
      <section className="artist-main" id="dashboard">
        <div className="artist-welcome">
          <div><p>WELCOME, ARTIST</p><h1>{name} 작가님,<br/>안녕하세요.</h1><span>등록한 프로필과 작품, 신청 상태를 한곳에서 확인할 수 있습니다.</span></div>
          <div className="artist-current-state"><span>현재 공개 상태</span><strong>{applicationState}</strong><small>{current ? `최근 접수 ${date(current.created_at)}` : "작가 신청서를 먼저 등록해주세요."}</small></div>
        </div>

        <div className="artist-metrics">
          <article><span>ACCOUNT STATUS</span><strong>{accountState}</strong><small>작가 계정 상태</small></article>
          <article><span>ARTWORKS</span><strong>{works.length}<em>점</em></strong><small>등록된 대표 작품</small></article>
          <article><span>LAST LOGIN</span><strong className="date-value">{date(account?.last_login_at || null)}</strong><small>최근 로그인</small></article>
        </div>

        {current ? <div className="artist-dashboard-grid">
          <section className="artist-card artist-profile-card" id="profile">
            <div className="artist-card-head"><div><p>ARTIST PROFILE</p><h2>등록 프로필</h2></div><em className={`status status-${current.status}`}>{applicationState}</em></div>
            <div className="artist-summary-layout">
              {profile ? <img className="artist-profile-image" src={`${imageApi}?key=${encodeURIComponent(profile.key)}`} alt="작가 프로필"/> : <div className="artist-profile-placeholder">{name.slice(0, 1)}</div>}
              <div className="artist-profile-copy"><span>{payload.categories?.join(" · ") || "등록 분야 없음"}</span><h3>{current.artist_name}</h3><blockquote>{String(values.tagline || "작가 한 줄 소개가 아직 없습니다.")}</blockquote><p>{String(values.bio || "작가 소개가 아직 없습니다.")}</p><dl><div><dt>신청번호</dt><dd>{current.id}</dd></div><div><dt>접수일</dt><dd>{date(current.created_at)}</dd></div><div><dt>연락처</dt><dd>{current.phone}</dd></div><div><dt>이메일</dt><dd>{current.email || "-"}</dd></div></dl></div>
            </div>
            {payload.adminReview?.note && <div className="artist-review-note"><strong>운영진 안내</strong><p>{payload.adminReview.note}</p></div>}
          </section>

          <section className="artist-card" id="artworks">
            <div className="artist-card-head"><div><p>ARTWORK ARCHIVE</p><h2>대표 작품 {works.length}점</h2></div><span>작품 정보는 신청서를 기준으로 표시됩니다.</span></div>
            <div className="artist-dashboard-work-grid">
              {works.map((work, index) => {
                const image = images.find((item) => item.type === "work" && item.workIndex === index);
                return <article className="artist-work-item" key={work.id || index}>
                  <div className="artist-work-visual">{image ? <img src={`${imageApi}?key=${encodeURIComponent(image.key)}`} alt={`${work.title || "대표 작품"} 이미지`}/> : <div className="artist-missing-image">이미지 없음</div>}<span>{String(index + 1).padStart(2, "0")}</span></div>
                  <div><em>{work.status || "작품"}</em><strong>{work.title || "작품명 없음"}</strong><p>{work.description || "작품 설명이 없습니다."}</p></div>
                </article>;
              })}
            </div>
          </section>

          <section className="artist-card artist-info-card" id="channels">
            <div className="artist-card-head"><div><p>VISIT & CHANNELS</p><h2>방문·온라인 정보</h2></div>{canEdit && <button className="artist-card-action" type="button" {...profileEditorControl("show")}>공개 정보 수정</button>}</div>
            <dl>
              <div><dt>공방·작업실</dt><dd>{String(values.studioName || "-")}</dd></div>
              <div><dt>주소</dt><dd>{String(values.address || "-")}</dd></div>
              <div><dt>방문 방식</dt><dd>{String(values.visitType || "-")}</dd></div>
              <div><dt>운영시간</dt><dd>{String(values.hours || "-")}</dd></div>
              <div><dt>Instagram</dt><dd>{String(values.instagram || "-")}</dd></div>
              <div><dt>홈페이지</dt><dd>{String(values.website || "-")}</dd></div>
            </dl>
          </section>
          {isAdmin ? <section className="artist-empty-card" id="account"><span>ADMIN PREVIEW</span><h2>관리자 미리보기 화면입니다.</h2><p>작가 계정으로 전환하지 않고 실제 작가 페이지의 등록 정보를 확인하고 있습니다.</p><Link href={accountUrl}>계정 관리로 돌아가기 <b>→</b></Link></section> : <section className="artist-card artist-account-card" id="account"><PasswordChangeForm /></section>}
        </div> : <div className="artist-dashboard-grid">
          <section className="artist-empty-card" id="profile"><span>NO APPLICATION</span><h2>아직 연결된 작가 신청서가 없습니다.</h2><p>작가 신청서를 작성하면 프로필, 대표 작품 5점과 검토 상태가 이곳에 표시됩니다.</p><Link href="/apply">작가 정보 등록하기 <b>→</b></Link></section>
          {isAdmin ? <section className="artist-empty-card" id="account"><span>ADMIN PREVIEW</span><h2>관리자 미리보기 화면입니다.</h2><p>이 작가 계정에는 아직 연결된 신청서가 없습니다.</p><Link href={accountUrl}>계정 관리로 돌아가기 <b>→</b></Link></section> : <section className="artist-card artist-account-card" id="account"><PasswordChangeForm /></section>}
        </div>}
      </section>
    </div>
    {editableApplication && publicArtist && <dialog id={PROFILE_EDITOR_ID} className="artist-profile-popover" popover="auto" aria-label="공개 정보 수정"><ProfileEditForm modal applicationId={editableApplication.id} artist={publicArtist} payload={editablePayload}/></dialog>}
  </main>;
}

import Link from "next/link";
import { env } from "cloudflare:workers";
import { requireSession } from "../admin/admin-auth";
import { news, site } from "./content";

type SectionKind = "project" | "artists" | "passport" | "news" | "contact";
type ArtistRow = { id: string; artist_name: string; email: string; payload_json: string; image_keys_json: string };
type ImageRecord = { type?: string; key?: string };

function parse(value: string) {
  try { return JSON.parse(value) as { categories?: string[]; values?: Record<string, string | boolean>; works?: unknown[] }; } catch { return {}; }
}

async function getArtists() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS artist_applications (
    id TEXT PRIMARY KEY, artist_name TEXT NOT NULL, phone TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'received',
    payload_json TEXT NOT NULL, image_keys_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  const result = await env.DB.prepare("SELECT id, artist_name, email, payload_json, image_keys_json FROM artist_applications WHERE status = 'approved' ORDER BY created_at DESC").all<ArtistRow>();
  return result.results || [];
}

function Arrow() { return <span aria-hidden="true">↗</span>; }

export function Header({ user, activeHref }: { user: { role: "admin" | "artist" } | null; activeHref?: string }) {
  return <header className="clone-header section-header">
    <Link className="clone-brand" href="/"><b>{site.brand}</b><small>{site.subBrand}</small></Link>
    <nav className="clone-desktop-nav" aria-label="주요 메뉴">{site.nav.map(([label, href]) => <Link className={href === activeHref ? "is-active" : undefined} key={label} href={href}>{label}</Link>)}</nav>
    <div className="clone-utility">{user ? <><Link href={user.role === "admin" ? "/admin" : "/artist"}>내 정보</Link><a href={user.role === "admin" ? "/api/admin/logout" : "/api/auth/logout"}>로그아웃</a></> : <><Link href="/login">로그인</Link><Link href="/signup">회원가입</Link></>}<button aria-label="검색">⌕</button></div>
  </header>;
}

function PageIntro({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <section className="section-hero"><p>{eyebrow}</p><h1>{title}</h1><span>{text}</span></section>;
}

function ProjectContent() {
  return <div className="project-about">
    <nav className="project-about-nav" aria-label="프로젝트 소개 메뉴">
      <a href="#project-story">프로젝트 이야기</a>
      <a href="#agency-service">에이전시 서비스</a>
      <a href="#artist-map">작가 지도</a>
      <a href="#join-project">참여 안내</a>
    </nav>
    <section className="project-about-hero" id="project-story">
      <p>새로운 지역 예술문화를 만들어갑니다</p>
      <h1>감천 작가 프로젝트</h1>
      <span>감천의 골목에서 활동하는 작가와 작품을 기록하고, 사람과 지역이 다시 만나는 연결을 만듭니다.</span>
      <a className="project-about-pill" href="#agency-service">프로젝트 방향</a>
    </section>
    <section className="project-about-intro">
      <p className="project-about-kicker">SOCIAL VALUE</p>
      <h2>지나치는 감천에서<br /><em>작가를 만나러 오는 감천</em>으로</h2>
      <p className="project-about-lead">감천은 아름다운 풍경만으로 설명되지 않습니다. 골목 안에서 작업을 이어가는 작가와 공방, 그리고 그들의 작품이 감천의 다음 이야기를 만듭니다.</p>
      <p>감천 작가 프로젝트는 지역 예술가의 활동을 한 곳에 기록하고, 관광객의 발견이 실제 방문과 협업으로 이어지도록 돕는 로컬 아트 에이전시입니다.</p>
    </section>
    <section className="project-about-service" id="agency-service">
      <div className="project-about-heading"><p className="project-about-kicker">AGENCY SERVICE</p><h2>작가의 작업이<br />더 멀리 닿도록</h2><span>프로필과 작품을 정리하는 것에서 시작해, 전시·체험·굿즈·지역 협업까지 작가의 다음 기회를 설계합니다.</span></div>
      <div className="project-about-image"><img src="/assets/clone/artist-goods.png" alt="작가 작품과 협업 상품" /></div>
      <div className="project-about-cards"><article><b>01</b><strong>작가 프로필</strong><span>작가의 이야기와 작업 분야, 대표 작품을 하나의 페이지로 소개합니다.</span></article><article><b>02</b><strong>작품 아카이브</strong><span>작품의 이미지와 설명을 기록해 작가의 활동을 오래 보존합니다.</span></article><article><b>03</b><strong>협업 연결</strong><span>전시, 체험, 브랜드 협업과 새로운 방문 기회를 연결합니다.</span></article></div>
    </section>
    <section className="project-about-map" id="artist-map">
      <div><p className="project-about-kicker">ARTIST MAP</p><h2>골목의 정보가<br /><em>사람의 이야기</em>가 됩니다.</h2><span>작가의 위치와 작업실, 방문 가능 여부를 지도 위에 기록합니다. 앞으로 GPS·QR·Art Passport와 연결해 온라인에서 발견한 작가를 실제 공간에서 만나도록 하겠습니다.</span><Link className="section-button" href="/map">작가 지도 보기 <Arrow /></Link></div>
      <div className="project-about-map-card"><img src="/gamcheon-map-concept.png" alt="감천 작가 지도 콘셉트" /><span>MAP · GPS · QR · PASSPORT</span></div>
    </section>
    <section className="project-about-join" id="join-project"><p className="project-about-kicker">JOIN THE PROJECT</p><h2>당신의 작업과 이야기를<br />감천에서 들려주세요.</h2><span>작가님의 정보는 운영진 검토 후 작가 소개와 지도 콘텐츠에 연결됩니다.</span><Link className="project-about-pill" href="/apply">작가 참여 신청</Link></section>
  </div>;
}

async function ArtistsContent() {
  const artists = await getArtists();
  return <section className="artist-directory">
    <nav className="artist-directory-tabs" aria-label="작가 소개 분류"><span aria-current="page">참여 작가</span><Link href="/news">전시·프로젝트</Link></nav>
    <div className="artist-directory-intro"><p>ARTIST DIRECTORY</p><h1>감천의 작가와 작품을 소개합니다.</h1><span>감천에서 활동하는 작가의 작업과 이야기를 기록합니다.<br />한 사람의 작품에서 골목의 새로운 경험이 시작됩니다.</span></div>
    {artists.length ? <nav className="artist-directory-names" aria-label="작가 바로가기">{artists.map((artist) => <a key={artist.id} href={`#artist-${artist.id}`}>{artist.artist_name}</a>)}</nav> : null}
    <div className="artist-directory-grid">{artists.length ? artists.map((artist) => { const payload = parse(artist.payload_json); const images = (() => { try { return JSON.parse(artist.image_keys_json) as ImageRecord[]; } catch { return []; } })(); const profile = images.find((image) => image.type === "profile" && image.key); const detailHref = `/artists/${encodeURIComponent(artist.id)}`; return <article className="artist-directory-card" id={`artist-${artist.id}`} key={artist.id}><Link className="artist-directory-media" href={detailHref}>{profile?.key ? <img src={`/api/artists/images?key=${encodeURIComponent(profile.key)}`} alt={`${artist.artist_name} 작가 프로필`} /> : <span aria-hidden="true">{artist.artist_name.slice(0, 1)}</span>}</Link><Link className="artist-directory-copy" href={detailHref}><h2>{artist.artist_name} <small>작가</small></h2><span>{payload.categories?.join(" · ") || "작품 분야 준비 중"}</span></Link></article>; }) : <div className="section-empty">승인된 작가 정보를 준비하고 있습니다.</div>}</div>
    <div className="artist-directory-footer"><span>현재 {artists.length}명의 작가가 함께하고 있습니다.</span><Link className="section-button" href="/apply">작가 참여 신청 <Arrow /></Link></div>
  </section>;
}

function PassportContent() {
  const steps = [["01", "지도에서 작가 발견", "현재 위치를 기준으로 가까운 작가와 작업 공간을 찾습니다."], ["02", "작가 페이지 확인", "작가의 이야기와 대표 작품, 방문 정보를 먼저 살펴봅니다."], ["03", "현장에서 방문 기록", "작가 공간의 QR을 스캔해 나만의 방문 기록을 남깁니다."], ["04", "다음 골목으로 연결", "주변의 다른 작가와 공간을 추천받아 여정을 이어갑니다."]];
  return <div className="passport-page">
    <section className="passport-hero">
      <div className="passport-hero-copy"><p>GAMCHEON ART PASSPORT</p><h1>작가를 만나고,<br />감천을 기록하는<br /><em>아트 패스포트.</em></h1><span>지도에서 작가를 발견하고, 골목을 걸어 작품을 만나고, 방문의 기억을 하나씩 모으는 감천만의 문화 여정입니다.</span><Link className="section-button" href="/map">작가 지도에서 시작 <Arrow /></Link></div>
      <div className="passport-preview" aria-label="감천 아트 패스포트 미리보기"><div className="passport-cover"><span>GAMCHEON</span><strong>ART<br />PASS</strong><small>LOCAL ART JOURNEY · 2026</small></div><div className="passport-inside"><div><b>MY ART JOURNEY</b><span>감천의 작가를 따라 걷는 네 번의 만남</span></div><div className="passport-stamps">{["발견", "방문", "기록", "연결"].map((label, index) => <i key={label}>{String(index + 1).padStart(2, "0")}<small>{label}</small></i>)}</div><small>QR STAMP · COMING SOON</small></div></div>
    </section>
    <section className="passport-intro"><p>WHAT IS ART PASSPORT?</p><h2>여행의 경로가<br /><em>작가와 작품의 기록</em>이 됩니다.</h2><span>아트 패스포트는 단순한 관광 스탬프가 아닙니다. 방문객에게는 골목을 탐색하는 이유를, 작가에게는 새로운 만남의 기회를, 감천에는 오래 남는 문화 기록을 만듭니다.</span><div className="passport-values"><article><b>01</b><strong>방문객</strong><span>취향에 맞는 작가와 작품을 발견하는 여행</span></article><article><b>02</b><strong>작가</strong><span>온라인 소개가 실제 방문으로 이어지는 접점</span></article><article><b>03</b><strong>감천</strong><span>골목의 사람과 공간을 연결하는 문화 기록</span></article></div></section>
    <section className="passport-how"><div className="passport-heading"><p>HOW IT WORKS</p><h2>네 단계로 이어지는<br />작가와의 만남</h2></div><div className="section-step-list">{steps.map(([number, title, text], index) => <article key={number}><b>{number}</b><div><strong>{title}</strong><span>{text}</span>{index > 1 ? <small>준비 중</small> : null}</div></article>)}</div></section>
    <section className="passport-roadmap"><div className="passport-heading"><p>MVP ROADMAP</p><h2>지금은 작가 지도부터<br />차근차근 연결합니다.</h2><span>실제 작가와 공간 정보가 충분히 쌓인 뒤 QR 방문 기록과 패스포트 기능을 단계적으로 공개합니다.</span></div><div className="passport-roadmap-list"><article><b>NOW</b><strong>작가 프로필 · 작품 · 지도</strong><span>작가 정보를 모으고 지도에서 발견할 수 있는 기반을 구축합니다.</span></article><article><b>NEXT</b><strong>현장 QR · 방문 기록</strong><span>참여 공간을 중심으로 QR 방문 기록을 현장 테스트합니다.</span></article><article><b>LATER</b><strong>스탬프 · 코스 · 혜택</strong><span>검증된 방문 흐름을 바탕으로 패스포트 경험을 확장합니다.</span></article></div></section>
    <section className="passport-cta"><div><p>ART PASSPORT · COMING SOON</p><strong>먼저 감천의 작가를 만나보세요.</strong><span>아트 패스포트는 참여 작가와 지도 데이터가 쌓이는 순서에 맞춰 공개됩니다.</span></div><Link className="section-button" href="/artists">참여 작가 보기 <Arrow /></Link></section>
  </div>;
}

function NewsContent() {
  return <div className="section-news-grid">{news.map(([category, title, date, image]) => <article key={title}><img src={image} alt=""/><span>{category}</span><h2>{title}</h2><time>{date}</time><p>감천 작가 프로젝트의 모집, 기록, 현장 테스트 소식을 전합니다.</p></article>)}</div>;
}

function ContactContent() {
  return <>
    <div className="section-copy-grid"><article><p>PARTNERS &amp; CLIENTS</p><h2>감천의 작가와 함께할 방법을 찾습니다.</h2><span>전시, 아트 큐레이션, 관광 콘텐츠, 상품 제작, 체험 프로그램, 지역 캠페인 협업을 제안해주세요.</span></article><article><p>COLLABORATION MODEL</p><h2>B2C · B2B · B2G</h2><span>관광객에게는 새로운 방문 경험을, 작가에게는 홍보·방문·판매의 접점을, 지역과 기관에는 문화관광 활성화의 기반을 제공합니다.</span></article></div>
    <div className="section-contact-grid">{[["관광객·방문객", "Art Passport, 체험, 골목 여행 콘텐츠"], ["작가·공방", "작가 페이지, 작품 소개, 방문 연결"], ["지역 상점·브랜드", "굿즈, 큐레이션, 공동 캠페인"], ["기관·지자체", "지역 문화관광, 데이터, 현장 실증"]].map(([title, text]) => <article key={title}><strong>{title}</strong><span>{text}</span></article>)}</div>
    <div className="section-callout"><strong>새김 협업 제안은 이메일로 보내주세요. 프로젝트 방향에 맞춰 함께 설계하겠습니다.</strong><a className="section-button" href="mailto:rjbcom4263@gmail.com">rjbcom4263@gmail.com <Arrow /></a></div>
  </>;
}

export default async function SectionPage({ kind }: { kind: SectionKind }) {
  const user = await requireSession();
  const pages = {
    project: ["PROJECT INTRODUCTION", "지나치는 감천에서 작가를 만나러 오는 감천으로.", "감천 아티스트맵은 지역 작가·공방·작품을 중심으로 관광객의 실제 방문과 새로운 경험을 연결하는 로컬 문화관광 플랫폼입니다."],
    artists: ["ARTIST DIRECTORY", "감천의 작가와 작품을 만나는 페이지.", "작가의 작업과 이야기를 기록하고, 작가에게는 새로운 방문과 협업의 기회를 연결합니다."],
    passport: ["ART PASSPORT", "작가의 공간을 방문하고 작품의 이야기를 수집하세요.", "지도·GPS·QR과 함께 감천의 골목을 걷고, 작가와 작품을 더 가까이 만나는 문화 경험입니다."],
    news: ["GAMCHEON NEWS", "감천 작가 프로젝트의 새로운 소식.", "작가 모집, 작품 아카이빙, 지도 구축과 현장 실증의 진행 상황을 기록합니다."],
    contact: ["PARTNERS & CLIENTS", "감천의 작가를 함께 응원하고 연결합니다.", "전시, 체험, 상품 제작, 지역 캠페인과 문화관광 협업을 제안해주세요."],
  } as const;
  const [eyebrow, title, text] = pages[kind];
  const content = kind === "project" ? <ProjectContent/> : kind === "artists" ? <ArtistsContent/> : kind === "passport" ? <PassportContent/> : kind === "news" ? <NewsContent/> : <ContactContent/>;
  return <main className="clone-page section-page"><Header user={user ? { role: user.role } : null} activeHref={`/${kind}`}/>{kind === "project" || kind === "artists" || kind === "passport" ? content : <><PageIntro eyebrow={eyebrow} title={title} text={text}/><section className="section-body">{content}</section></>}<footer className="clone-footer"><div className="clone-brand"><b>{site.brand}</b><small>{site.subBrand}</small></div><div><p>새김 | 감천 작가 프로젝트</p><p>rjbcom4263@gmail.com</p><p>부산광역시 감천문화마을</p></div><div><Link href="/apply">작가 참여</Link><Link href="/map">작가 지도</Link><Link href="/">메인으로</Link></div><small>© 2026 GAMCHEON ARTISTS. ALL RIGHTS RESERVED.</small></footer><Link className="clone-chat" href="/apply"><span>작가님,<br/>함께할까요?</span><b>문의하기 <Arrow/></b></Link></main>;
}

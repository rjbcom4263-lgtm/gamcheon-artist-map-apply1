"use client";

/* eslint-disable @next/next/no-img-element -- dynamic R2 images are served through the validated public image API. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { SAVED_ARTISTS_KEY, type PublicArtist } from "../public-artist";
import type { StudioStatus } from "../../lib/studio-hours";
import "./artist-detail.css";

// 원본 구조(폰 프레임·섹션 순서·크림/그린 색)는 그대로 두고, Bunzee 설계(장소 상세)에서
// 정보 확인 시점, 진입 사진·이동 조건, 작품 해설 연결, 정보 변경 제보만 더했습니다.

export type GuideLink = { id: string; title: string };
type IconName = "back" | "heart" | "share" | "pin" | "clock" | "visit" | "close" | "grid" | "warning" | "steps" | "book" | "arrow" | "pencil" | "caretLeft" | "caretRight" | "check";

/** D1 타임스탬프(UTC, Z 없음)나 YYYY-MM-DD를 "2026.05.12"로 표시합니다. */
function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+09:00` : value + (value.endsWith("Z") ? "" : "Z"));
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${pick("year")}.${pick("month")}.${pick("day")}`;
}

export function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    back: <path d="m15 5-7 7 7 7"/>,
    heart: <path d="M20.5 9.3c0 5.1-8.5 10-8.5 10s-8.5-4.9-8.5-10A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.5 3.2Z"/>,
    share: <><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"/></>,
    pin: <><path d="M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.2"/></>,
    clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></>,
    visit: <><path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
    warning: <><circle cx="12" cy="12" r="8.5"/><path d="M12 8v4.5M12 15.5v.5"/></>,
    steps: <path d="M4 19h4v-4h4v-4h4V7h4"/>,
    book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Z"/><path d="M4 5v16"/><path d="M8 7h7M8 11h7"/></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
    pencil: <path d="m4 20 4-1L19.5 7.5a2 2 0 0 0-3-3L5 16l-1 4Z"/>,
    caretLeft: <path d="m14 6-6 6 6 6"/>,
    caretRight: <path d="m10 6 6 6-6 6"/>,
    check: <path d="m5 12 4.5 4.5L19 7"/>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[name]}</svg>;
}

export default function ArtistDetail({ artist, guides = [] }: { artist: PublicArtist; guides?: GuideLink[] }) {
  const [saved, setSaved] = useState(false);
  const [workIndex, setWorkIndex] = useState<number | null>(null);
  const [entry, setEntry] = useState(0);
  const work = workIndex === null ? null : artist.works[workIndex];
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);
  const photo = photoIndex === null ? null : artist.gallery[photoIndex];
  const entrance = artist.entrances[entry];
  const verified = formatDate(artist.verifiedAt);
  const registered = formatDate(artist.registeredAt);
  const accessPills = ([
    { icon: "steps", label: artist.access.stairs },
    { icon: "visit", label: artist.access.slope },
    { icon: "warning", label: artist.access.restriction },
  ] satisfies { icon: IconName; label: string }[]).filter((pill) => pill.label);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setSaved((JSON.parse(localStorage.getItem(SAVED_ARTISTS_KEY) || "[]") as unknown[]).includes(artist.id)); } catch {}
    });
    return () => window.clearTimeout(timer);
  }, [artist.id]);

  function toggleSaved() {
    setSaved((current) => {
      let ids: string[] = [];
      try { ids = (JSON.parse(localStorage.getItem(SAVED_ARTISTS_KEY) || "[]") as unknown[]).filter((id): id is string => typeof id === "string"); } catch {}
      const next = current ? ids.filter((id) => id !== artist.id) : [...new Set([...ids, artist.id])];
      localStorage.setItem(SAVED_ARTISTS_KEY, JSON.stringify(next));
      return !current;
    });
  }

  async function share() {
    if (navigator.share) await navigator.share({ title: `${artist.name} 작가`, text: artist.tagline, url: location.href }).catch(() => {});
    else await navigator.clipboard?.writeText(location.href);
  }

  return <div className="artist-detail-page">
    <div className="artist-detail-phone">
      <span className="artist-phone-speaker" aria-hidden="true"/>
      <main className="artist-detail-scroll">
        <header className="artist-detail-top"><Link href={`/map?artist=${encodeURIComponent(artist.id)}`} aria-label="지도로 돌아가기"><Icon name="back"/></Link><strong>작가와 작품</strong><button type="button" onClick={share} aria-label="공유하기"><Icon name="share"/></button></header>

        <section className="artist-profile-hero">
          <img src={artist.profile} alt={`${artist.name} 작가 프로필`}/><div className="artist-hero-shade"/>
          <div className="artist-hero-copy"><span>{artist.categories.join(" · ") || "감천 참여 작가"}</span><h1>{artist.name}</h1><p>{artist.tagline}</p></div>
          <button className={saved ? "is-saved" : ""} type="button" onClick={toggleSaved} aria-label={saved ? "저장 취소" : "작가 저장"}><Icon name="heart"/></button>
        </section>

        <section className="artist-profile-summary">
          <div><span>작품</span><strong>{artist.works.length}<small>점</small></strong></div><div><span>분야</span><strong>{artist.categories[0] || "예술"}</strong></div><div><span>작업실</span><strong>{artist.studio}</strong></div>
        </section>

        <section className="artist-work-section">
          <div className="artist-detail-heading"><div><span>WORK ARCHIVE</span><h2>대표 작품</h2></div><Icon name="grid"/></div>
          {artist.works.length ? <div className="artist-work-grid">{artist.works.map((item, index) => <button type="button" key={`${item.title}-${index}`} onClick={() => setWorkIndex(index)} aria-label={`${item.title} 자세히 보기`}><img src={item.image} alt={item.title}/><span>{item.title}</span></button>)}</div> : <p className="artist-detail-empty">등록된 대표 작품을 준비하고 있습니다.</p>}
          {guides.length > 0 && <div className="artist-guides"><span><Icon name="book"/>작품 해설</span>{guides.map((guide) => <Link key={guide.id} href={`/w/${encodeURIComponent(guide.id)}`}>{guide.title}<Icon name="arrow"/></Link>)}</div>}
        </section>

        <section className="artist-story-section"><span>ARTIST STORY</span><h2>작가의 이야기</h2><blockquote>“{artist.tagline}”</blockquote><p>{artist.bio}</p></section>

        {artist.gallery.length > 0 && <section className="artist-gallery-section">
          <div className="artist-detail-heading"><div><span>STUDIO PHOTOS</span><h2>작업실 풍경</h2></div><small>{artist.gallery.length}장</small></div>
          <StudioGallery photos={artist.gallery} onOpen={setPhotoIndex}/>
        </section>}

        <section className="artist-visit-section">
          <div className="artist-detail-heading"><div><span>STUDIO VISIT</span><h2>화실 방문 정보</h2></div></div>
          <dl><div><dt><Icon name="visit"/>작업실</dt><dd>{artist.studio}</dd></div><div><dt><Icon name="pin"/>위치</dt><dd>{artist.address}</dd></div><div><dt><Icon name="clock"/>운영시간</dt><dd>{artist.status && <StatusBadge status={artist.status}/>}{artist.hours}</dd></div><div><dt><Icon name="visit"/>방문 방식</dt><dd>{artist.visitType}</dd></div><div><dt><Icon name={verified ? "check" : "warning"}/>정보 확인</dt><dd>{verified ? `${verified} 현장 확인` : "현장 확인 전"}{registered && <small>{registered} 작가 등록</small>}</dd></div></dl>
          <p className={`artist-visit-note${verified ? "" : " is-unverified"}`}><Icon name="warning"/>임시 휴무와 체험 가능 시간은 달라질 수 있어요. 방문 전 작가 채널에서 다시 확인해주세요.</p>
          {artist.experiences.map((experience) => <div className="artist-experience" key={experience.id}><span>{experience.title} · {experience.status}</span><p>{experience.description || "체험 프로그램의 자세한 내용은 작가에게 문의해주세요."}</p></div>)}
          <Link className="artist-report-link" href="/contact"><Icon name="pencil"/>정보가 달라졌나요? 변경 제보하기</Link>
        </section>

        <section className="artist-access-section">
          <div className="artist-detail-heading"><div><span>HOW TO GET THERE</span><h2>진입 안내</h2></div>{artist.entrances.length > 0 && <small>{entry + 1} / {artist.entrances.length}</small>}</div>
          {entrance ? <div className="artist-entry"><img src={entrance.image} alt={entrance.caption}/><div><button type="button" onClick={() => setEntry((entry + artist.entrances.length - 1) % artist.entrances.length)} aria-label="이전 진입 지점"><Icon name="caretLeft"/></button><span>{entrance.caption}</span><button type="button" onClick={() => setEntry((entry + 1) % artist.entrances.length)} aria-label="다음 진입 지점"><Icon name="caretRight"/></button></div></div>
            : <p className="artist-detail-empty">큰길에서 입구까지의 진입 사진은 현장 확인 후 추가됩니다.</p>}
          <p className="artist-access-note">{artist.access.note || "계단·경사 정보가 아직 등록되지 않았습니다. 감천은 골목 계단이 많으니 이동에 여유를 두세요."}</p>
          <div className="artist-access-pills"><span><Icon name="pin"/>{artist.address}</span>{accessPills.map((pill) => <span key={pill.label}><Icon name={pill.icon}/>{pill.label}</span>)}</div>
        </section>

        {(artist.instagram || artist.website || artist.shopUrl) && <section className="artist-channel-section"><span>작가 채널</span><div>{artist.instagram && <a href={artist.instagram} target="_blank" rel="noreferrer">Instagram ↗</a>}{artist.website && <a href={artist.website} target="_blank" rel="noreferrer">Website ↗</a>}{artist.shopUrl && <a href={artist.shopUrl} target="_blank" rel="noreferrer">작품 구매 ↗</a>}</div></section>}
      </main>

      <nav className="artist-detail-actions"><Link href={`/map?artist=${encodeURIComponent(artist.id)}`}><Icon name="pin"/>지도에서 보기</Link><button className={saved ? "is-saved" : ""} type="button" onClick={toggleSaved}><Icon name="heart"/>{saved ? "저장됨" : "저장"}</button></nav>

      {photo && <div className="work-lightbox" role="dialog" aria-modal="true" aria-label="작업실 사진 크게 보기"><button className="work-lightbox-close" type="button" onClick={() => setPhotoIndex(null)} aria-label="닫기"><Icon name="close"/></button><div className="work-lightbox-content"><img src={photo.image} alt={photo.caption || "작업실 사진"}/><article><span>STUDIO {String(photoIndex! + 1).padStart(2, "0")} / {String(artist.gallery.length).padStart(2, "0")}</span>{photo.caption && <p>{photo.caption}</p>}</article></div></div>}
      {work && <div className="work-lightbox" role="dialog" aria-modal="true" aria-label={`${work.title} 작품 상세`}><button className="work-lightbox-close" type="button" onClick={() => setWorkIndex(null)} aria-label="닫기"><Icon name="close"/></button><div className="work-lightbox-content"><img src={work.image} alt={work.title}/><article><span>WORK {String(workIndex! + 1).padStart(2, "0")} {work.status && `· ${work.status}`}</span><h2>{work.title}</h2><p>{work.description}</p></article></div></div>}
    </div>
  </div>;
}

export function StatusBadge({ status }: { status: StudioStatus }) {
  return <span className={`studio-badge studio-badge--${status.state}`}><b>{status.label}</b>{status.detail}</span>;
}

export function StudioGallery({ photos, onOpen }: { photos: Array<{ image: string; caption: string }>; onOpen?: (index: number) => void }) {
  return <div className="artist-gallery-strip">{photos.map((item, index) => <button type="button" key={`${item.image}-${index}`} onClick={() => onOpen?.(index)} aria-label={`작업실 사진 ${index + 1}${item.caption ? `: ${item.caption}` : ""} 크게 보기`}><img src={item.image} alt={item.caption || `작업실 사진 ${index + 1}`} loading="lazy"/>{item.caption && <span>{item.caption}</span>}</button>)}</div>;
}

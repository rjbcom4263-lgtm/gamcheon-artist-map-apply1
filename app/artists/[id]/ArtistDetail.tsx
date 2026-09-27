"use client";

/* eslint-disable @next/next/no-img-element -- dynamic R2 images are served through the validated public image API. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { SAVED_ARTISTS_KEY, type PublicArtist } from "../public-artist";
import "./artist-detail.css";

type IconName = "back" | "heart" | "share" | "pin" | "clock" | "visit" | "close" | "grid";

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
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[name]}</svg>;
}

export default function ArtistDetail({ artist }: { artist: PublicArtist }) {
  const [saved, setSaved] = useState(false);
  const [workIndex, setWorkIndex] = useState<number | null>(null);
  const work = workIndex === null ? null : artist.works[workIndex];

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
        </section>

        <section className="artist-story-section"><span>ARTIST STORY</span><h2>작가의 이야기</h2><blockquote>“{artist.tagline}”</blockquote><p>{artist.bio}</p></section>

        <section className="artist-visit-section">
          <div className="artist-detail-heading"><div><span>STUDIO VISIT</span><h2>화실 방문 정보</h2></div></div>
          <dl><div><dt><Icon name="visit"/>작업실</dt><dd>{artist.studio}</dd></div><div><dt><Icon name="pin"/>위치</dt><dd>{artist.address}</dd></div><div><dt><Icon name="clock"/>운영시간</dt><dd>{artist.hours}</dd></div><div><dt><Icon name="visit"/>방문 방식</dt><dd>{artist.visitType}</dd></div></dl>
          {artist.experience && artist.experience !== "없음" && <div className="artist-experience"><span>체험 프로그램 · {artist.experience}</span><p>{artist.experienceDesc || "체험 프로그램의 자세한 내용은 작가에게 문의해주세요."}</p></div>}
        </section>

        {(artist.instagram || artist.website || artist.shopUrl) && <section className="artist-channel-section"><span>작가 채널</span><div>{artist.instagram && <a href={artist.instagram} target="_blank" rel="noreferrer">Instagram ↗</a>}{artist.website && <a href={artist.website} target="_blank" rel="noreferrer">Website ↗</a>}{artist.shopUrl && <a href={artist.shopUrl} target="_blank" rel="noreferrer">작품 구매 ↗</a>}</div></section>}
      </main>

      <nav className="artist-detail-actions"><Link href={`/map?artist=${encodeURIComponent(artist.id)}`}><Icon name="pin"/>지도에서 보기</Link><button className={saved ? "is-saved" : ""} type="button" onClick={toggleSaved}><Icon name="heart"/>{saved ? "저장됨" : "저장"}</button></nav>

      {work && <div className="work-lightbox" role="dialog" aria-modal="true" aria-label={`${work.title} 작품 상세`}><button className="work-lightbox-close" type="button" onClick={() => setWorkIndex(null)} aria-label="닫기"><Icon name="close"/></button><div className="work-lightbox-content"><img src={work.image} alt={work.title}/><article><span>WORK {String(workIndex! + 1).padStart(2, "0")} {work.status && `· ${work.status}`}</span><h2>{work.title}</h2><p>{work.description}</p></article></div></div>}
    </div>
  </div>;
}

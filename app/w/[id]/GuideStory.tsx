"use client";

/* eslint-disable @next/next/no-img-element -- the artwork photo is served by the R2-backed image route. */
import Link from "next/link";
import { useState } from "react";
import { GUIDE_LANGUAGES, type Translation } from "../../work-guides/shared";

export default function GuideStory({ id, applicationId, artistName, title, description, translations, initialLanguage }: {
  id: string; applicationId: string; artistName: string; title: string; description: string; translations: Record<string, Translation>; initialLanguage: string;
}) {
  const [language, setLanguage] = useState(initialLanguage);
  const available = GUIDE_LANGUAGES.filter(({ code }) => translations[code]?.description);
  const shown = language !== "ko" && translations[language] ? translations[language] : { title, description };
  return <main className="work-guide-page" lang={language} onContextMenu={(event) => event.preventDefault()} onCopy={(event) => event.preventDefault()} onCut={(event) => event.preventDefault()} onDragStart={(event) => event.preventDefault()}>
    <header><Link href="/">GAMCHEON ARTISTS<small>LOCAL ARTS AGENCY</small></Link><span>ARTWORK STORY</span></header>
    <article className="work-guide-article">
      <div className="work-guide-photo"><img src={`/api/work-guides/${encodeURIComponent(id)}/image`} alt={shown.title} draggable={false}/><div className="work-guide-watermark" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <span key={index}>© {artistName} · GAMCHEON ARTISTS</span>)}</div></div>
      <div className="work-guide-content"><p className="work-guide-eyebrow">GAMCHEON · ARTWORK STORY</p><span className="work-guide-artist">{artistName} 작가의 작품</span><h1>{shown.title}</h1>
        <div className="work-guide-languages" aria-label="해설 언어 선택"><button type="button" className={language === "ko" ? "active" : ""} aria-pressed={language === "ko"} onClick={() => setLanguage("ko")}>한국어</button>{available.map(({ code, label }) => <button type="button" key={code} className={language === code ? "active" : ""} aria-pressed={language === code} onClick={() => setLanguage(code)}>{label}</button>)}</div>
        <div className="work-guide-description" lang={language}>{shown.description.split("\n").map((line, index) => <p key={index}>{line || "\u00a0"}</p>)}</div>
        <p className="work-guide-protection">© {artistName} · 작품 보호를 위해 캡처·녹화 및 무단 복제를 삼가 주세요.<br/>Please do not capture, record or reproduce this artwork.</p><footer><span>작품에 담긴 이야기를 천천히 읽어보세요.</span><Link href={`/artists/${encodeURIComponent(applicationId)}`}>작가 소개 보기 ↗</Link></footer>
      </div>
    </article>
  </main>;
}

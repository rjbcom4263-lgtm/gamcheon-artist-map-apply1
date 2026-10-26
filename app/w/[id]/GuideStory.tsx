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
  return <main className="work-guide-page">
    <header><Link href="/">GAMCHEON ARTISTS<small>LOCAL ARTS AGENCY</small></Link><span>ARTWORK STORY</span></header>
    <article className="work-guide-article">
      <div className="work-guide-photo"><img src={`/api/work-guides/${encodeURIComponent(id)}/image`} alt={`${title} 작품 사진`}/></div>
      <div className="work-guide-content"><p className="work-guide-eyebrow">GAMCHEON · ARTWORK STORY</p><span className="work-guide-artist">{artistName} 작가의 작품</span><h1>{shown.title}</h1>
        <div className="work-guide-languages" aria-label="해설 언어 선택"><button type="button" className={language === "ko" ? "active" : ""} aria-pressed={language === "ko"} onClick={() => setLanguage("ko")}>한국어</button>{available.map(({ code, label }) => <button type="button" key={code} className={language === code ? "active" : ""} aria-pressed={language === code} onClick={() => setLanguage(code)}>{label}</button>)}</div>
        <div className="work-guide-description" lang={language}>{shown.description.split("\n").map((line, index) => <p key={index}>{line || "\u00a0"}</p>)}</div>
        <footer><span>작품에 담긴 이야기를 천천히 읽어보세요.</span><Link href={`/artists/${encodeURIComponent(applicationId)}`}>작가 소개 보기 ↗</Link></footer>
      </div>
    </article>
  </main>;
}

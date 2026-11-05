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
      <div className="work-guide-photo"><img src={`/api/work-guides/${encodeURIComponent(id)}/image`} alt={shown.title} draggable={false}/></div>
      <div className="work-guide-content"><p className="work-guide-eyebrow">GAMCHEON · ARTWORK STORY</p><span className="work-guide-artist">{artistName} 작가의 작품</span><h1>{shown.title}</h1>
        <div className="work-guide-languages" aria-label="해설 언어 선택"><button type="button" className={language === "ko" ? "active" : ""} aria-pressed={language === "ko"} onClick={() => setLanguage("ko")}>한국어</button>{available.map(({ code, label }) => <button type="button" key={code} className={language === code ? "active" : ""} aria-pressed={language === code} onClick={() => setLanguage(code)}>{label}</button>)}</div>
        <div className="work-guide-description" lang={language}>{shown.description.split("\n").map((line, index) => <p key={index}>{line || "\u00a0"}</p>)}</div>
        <p className="work-guide-protection">© {artistName} · 작품 보호를 위해 캡처·녹화 및 무단 복제를 삼가 주세요.<br/>Please do not capture, record or reproduce this artwork.</p>
        <details className="work-guide-rights"><summary>작품 이용 안내 · Copyright &amp; enquiries</summary><p>작품의 저작권은 해당 작가에게 있습니다. 이 페이지는 작품 감상을 위해 제공됩니다. 작가의 사전 허락 없이 작품 이미지를 복제·재배포하거나 판매·상품 제작 등 상업적으로 이용하지 말아 주세요.</p><p lang="en">Copyright belongs to the artist. Images are provided for viewing. Please obtain the artist’s permission before reproducing, redistributing or using them commercially.</p><p>이용 허락 문의 또는 도용 신고 시 작품 주소와 도용이 의심되는 곳의 주소를 함께 보내주세요. 확인에 필요한 정보만 포함해 주세요.</p><a href={`mailto:rjbcom4263@gmail.com?subject=${encodeURIComponent(`[작품 이용 문의·도용 신고] ${title}`)}&body=${encodeURIComponent(`작품: ${title}\n작가: ${artistName}\n작품 주소: https://artist-map.com/w/${id}\n\n문의 내용 또는 도용 의심 주소:\n`)}`}>이용 문의·도용 신고 ↗</a></details><footer><span>작품에 담긴 이야기를 천천히 읽어보세요.</span><Link href={`/artists/${encodeURIComponent(applicationId)}`}>작가 소개 보기 ↗</Link></footer>
      </div>
    </article>
  </main>;
}

"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import ArtistMapFrame, { type MapPlace } from "./ArtistMapFrame";
import type { ArtistPlace } from "./map-artists";
import "./full-art-map.css";

function TabIcon({ artists = false }: { artists?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {artists ? <><path d="M9 6h12M9 12h12M9 18h12"/><circle cx="3.5" cy="6" r=".7"/><circle cx="3.5" cy="12" r=".7"/><circle cx="3.5" cy="18" r=".7"/></> : <><path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/></>}
  </svg>;
}

export default function FullArtistMap({ initialPlaces, initialArtistId }: { initialPlaces: ArtistPlace[]; initialArtistId?: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(initialArtistId ?? null);
  const [view, setView] = useState<"home" | "artists">("home");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("전체");
  const mapped = useMemo(() => initialPlaces.filter(place => place.geoPosition), [initialPlaces]);
  const mapPlaces = useMemo(() => mapped.map((place): MapPlace => ({
    id: place.id, name: place.name, category: "attraction", ...place.geoPosition!,
    address: `${place.studio} · ${place.address}`,
    description: `${place.type} · ${place.hours} · ${place.visitType}`,
  })), [mapped]);
  const categories = useMemo(() => ["전체", ...Array.from(new Set(initialPlaces.flatMap(place => place.categories)))], [initialPlaces]);
  const visible = useMemo(() => initialPlaces.filter(place =>
    (category === "전체" || place.categories.includes(category)) &&
    `${place.name} ${place.studio} ${place.categories.join(" ")}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  ), [initialPlaces, query, category]);
  const selected = initialPlaces.find(place => place.id === selectedId);
  const select = useCallback((id: string) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (mapped.some(place => place.id === id)) url.searchParams.set("artist", id);
    else url.searchParams.delete("artist");
    window.history.replaceState(null, "", url);
  }, [mapped]);

  return <div className="artist-app">
    <header className="artist-app__header">
      <Link href="/" className="artist-app__brand" aria-label="GAMCHEON ARTISTS 홈페이지"><strong>GAMCHEON ARTISTS</strong><small>LOCAL ARTS AGENCY</small></Link>
      {view === "home" && selected ? <Link className="artist-app__detail" href={selected.detailHref}>작가 보기 ↗</Link> : <span className="artist-app__edition">ART MAP</span>}
    </header>
    <section className="artist-app__body">
      <div className="artist-app__map" hidden={view !== "home"}>
        <ArtistMapFrame full compactApp className="artist-app__frame" title="감천 작가 지도" places={mapPlaces} selectedId={selectedId} onSelect={select}/>
      </div>
      {view === "artists" && <section className="artist-app__directory" aria-label="작가 목록">
        <div className="artist-app__directory-head"><p>MEET THE ARTISTS</p><h1>작가 목록<span>{initialPlaces.length}</span></h1></div>
        <label className="artist-app__search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/></svg><input type="search" placeholder="이름 또는 공방 검색" aria-label="이름 또는 공방 검색" value={query} onChange={event => setQuery(event.target.value)}/></label>
        <div className="artist-app__filters" role="group" aria-label="작가 분야 분류">{categories.map(item => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
        <p className="artist-app__results" aria-live="polite">{visible.length}명의 작가</p>
        <div className="artist-app__list">{visible.map(place => <article className="artist-app__artist" key={place.id}>
          <Link className="artist-app__photo" href={place.detailHref} aria-label={`${place.name} 작가 소개`}><img src={place.image} alt={`${place.name} 작가`} loading="lazy"/></Link>
          <div className="artist-app__artist-info"><Link href={place.detailHref}><h2>{place.name}</h2></Link><p>{place.categories.join(" · ") || "감천 참여 작가"}</p><small>{place.studio}</small>
            {place.geoPosition ? <button type="button" onClick={() => { select(place.id); setView("home"); }}>지도에서 보기 ↗</button> : <span className="artist-app__pending">위치 확인 중</span>}
          </div><Link className="artist-app__arrow" href={place.detailHref} aria-label={`${place.name} 상세 보기`}>↗</Link>
        </article>)}</div>
        {!visible.length && <div className="artist-app__empty"><strong>{initialPlaces.length ? "검색 결과가 없습니다." : "작가를 소개할 준비를 하고 있어요."}</strong><p>{initialPlaces.length ? "다른 이름이나 분야로 찾아보세요." : "등록된 작가가 공개되면 이곳에서 만날 수 있습니다."}</p>{initialPlaces.length > 0 && <button type="button" onClick={() => { setQuery(""); setCategory("전체"); }}>전체 작가 보기</button>}</div>}
      </section>}
    </section>
    <nav className="artist-app__nav" aria-label="모바일 앱 메뉴">
      <button type="button" aria-current={view === "home" ? "page" : undefined} onClick={() => setView("home")}><TabIcon/><span>홈</span></button>
      <button type="button" aria-current={view === "artists" ? "page" : undefined} onClick={() => setView("artists")}><TabIcon artists/><span>작가 목록</span></button>
    </nav>
  </div>;
}

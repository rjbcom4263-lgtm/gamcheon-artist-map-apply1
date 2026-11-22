"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import ArtistMapFrame, { type MapPlace } from "./ArtistMapFrame";
import type { ArtistPlace } from "./map-artists";
import { refreshPlaceStatuses } from "../lib/studio-hours";
import { useMinuteTick } from "../lib/useMinuteTick";
import "./full-art-map.css";

function TabIcon({ artists = false }: { artists?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {artists ? <><path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r=".8"/><circle cx="4" cy="12" r=".8"/><circle cx="4" cy="18" r=".8"/></> : <><path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/></>}
  </svg>;
}

// 지도를 오래 열어 둬도 방문 상태가 바뀌게 합니다. 문구가 그대로면 같은 배열이 유지돼 지도에 다시 보내지 않습니다.
function useLivePlaces(initialPlaces: ArtistPlace[]) {
  const [places, setPlaces] = useState(initialPlaces);
  useMinuteTick(() => setPlaces((current) => refreshPlaceStatuses(current)));
  return places;
}

// 지도에 넘길 작가 공방. 목록·상세는 지도(art-map)가 그리므로 공방·분야·운영 상태·사진·작가 페이지를 함께 보냅니다.
// 운영시간을 등록하지 않은 작가는 방문 방식(예: 방문 전 문의)을 운영 안내 뒤에 붙입니다.
// 지도는 가운뎃점 대신 쉼표로 이어 씁니다. 운영 안내 문구(studio-hours)는 작가 페이지와 함께 쓰므로 여기서만 바꿉니다.
const withCommas = (text: string) => text.replaceAll(" · ", ", ");
export function toMapPlace(place: ArtistPlace): MapPlace {
  return {
    id: place.id, name: place.name, category: "attraction", ...place.geoPosition!,
    address: place.address,
    studio: place.studio,
    tags: place.categories,
    hours: withCommas(place.status ? place.hours : `${place.hours}, ${place.visitType}`),
    ...(place.status ? { status: place.status } : {}),
    photo: place.image,
    href: place.detailHref,
    ...(place.locationMode === "approximate" ? { approximate: true } : {}),
  };
}

export default function FullArtistMap({ initialPlaces, initialArtistId, siteHeader }: { initialPlaces: ArtistPlace[]; initialArtistId?: string; siteHeader?: ReactNode }) {
  const places = useLivePlaces(initialPlaces);
  const [selectedId, setSelectedId] = useState<string | null>(initialArtistId ?? null);
  const [view, setView] = useState<"home" | "artists">("home");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("전체");
  const mapped = useMemo(() => places.filter(place => place.geoPosition), [places]);
  const mapPlaces = useMemo(() => mapped.map(toMapPlace), [mapped]);
  const categories = useMemo(() => ["전체", ...Array.from(new Set(places.flatMap(place => place.categories)))], [places]);
  const visible = useMemo(() => places.filter(place =>
    (category === "전체" || place.categories.includes(category)) &&
    `${place.name} ${place.studio} ${place.categories.join(" ")}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  ), [places, query, category]);
  // 고른 작가를 주소(?artist=)에 남겨 새로고침하거나 공유해도 같은 작가가 열리게 합니다. 지도에서 닫으면 지웁니다.
  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id && mapped.some(place => place.id === id)) url.searchParams.set("artist", id);
    else url.searchParams.delete("artist");
    window.history.replaceState(null, "", url);
  }, [mapped]);
  const open = useCallback((id: string) => {
    const place = places.find(item => item.id === id);
    if (place) window.location.assign(place.detailHref);
  }, [places]);

  return <div className="artist-app">
    {siteHeader}
    <header className="artist-app__header">
      <Link href="/" className="artist-app__brand" aria-label="GAMCHEON ARTISTS 홈페이지"><strong>GAMCHEON ARTISTS</strong><small>LOCAL ARTS AGENCY</small></Link>
      <span className="artist-app__edition">ART MAP</span>
    </header>
    <section className="artist-app__body">
      <div className="artist-app__map" data-view={view}>
        <ArtistMapFrame full compactApp className="artist-app__frame" title="감천 작가 지도" places={mapPlaces} selectedId={selectedId} onSelect={select} onOpen={open}/>
      </div>
      {view === "artists" && <section className="artist-app__directory" aria-label="작가 목록">
        <div className="artist-app__directory-head"><p>MEET THE ARTISTS</p><h1>작가 목록<span>{places.length}명</span></h1></div>
        <label className="artist-app__search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" placeholder="이름 또는 공방 검색" aria-label="이름 또는 공방 검색" value={query} onChange={event => setQuery(event.target.value)}/></label>
        <div className="artist-app__filters" role="group" aria-label="작가 분야 분류">{categories.map(item => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
        <p className="artist-app__results" aria-live="polite">{visible.length}명의 작가</p>
        <div className="artist-app__list">{visible.map(place => <article className="artist-app__artist" key={place.id}>
          <Link className="artist-app__photo" href={place.detailHref} aria-label={`${place.name} 작가 소개`}><img src={place.image} alt={`${place.name} 작가`} loading="lazy"/></Link>
          <div className="artist-app__artist-info"><Link href={place.detailHref}><h2>{place.name}</h2></Link><p>{place.categories.join(", ") || "감천 참여 작가"}</p><small>{place.studio}</small>
            {place.status && <span className={`studio-badge studio-badge--${place.status.state}`}><b>{place.status.label}</b></span>}
            {place.geoPosition ? <button type="button" onClick={() => { select(place.id); setView("home"); }}>지도에서 보기</button> : <span className="artist-app__pending">{place.locationMode === "hidden" ? "위치는 작가에게 문의해 주세요" : "위치 확인 중"}</span>}
          </div>
        </article>)}</div>
        {!visible.length && <div className="artist-app__empty"><strong>{places.length ? "검색 결과가 없어요" : "작가를 소개할 준비를 하고 있어요"}</strong><p>{places.length ? "다른 이름이나 분야로 찾아보세요." : "등록된 작가가 공개되면 이곳에서 만날 수 있습니다."}</p>{places.length > 0 && <button type="button" onClick={() => { setQuery(""); setCategory("전체"); }}>전체 작가 보기</button>}</div>}
      </section>}
    </section>
    <nav className="artist-app__nav" aria-label="작가 지도 메뉴">
      <button type="button" aria-current={view === "home" ? "page" : undefined} onClick={() => setView("home")}><TabIcon/><span>홈</span></button>
      <button type="button" aria-current={view === "artists" ? "page" : undefined} onClick={() => setView("artists")}><TabIcon artists/><span>작가 목록</span></button>
    </nav>
  </div>;
}

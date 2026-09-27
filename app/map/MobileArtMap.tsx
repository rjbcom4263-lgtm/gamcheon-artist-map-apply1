"use client";

/* eslint-disable @next/next/no-img-element -- vinext's next/image shim breaks client hooks in development. */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ArtistPlace } from "./map-artists";
import ArtistMapFrame, { type MapPlace } from "./ArtistMapFrame";
import { SAVED_ARTISTS_KEY } from "../artists/public-artist";
import "./mobile-art-map.css";

type Tab = "home" | "map" | "my" | "menu";
type IconName = Tab | "search" | "heart" | "pin" | "walk" | "bell" | "chevron";

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5M9 20v-6h6v6"/></>,
    map: <><path d="m3.5 6 5-2 7 2 5-2v14l-5 2-7-2-5 2Z"/><path d="M8.5 4v14M15.5 6v14"/></>,
    my: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21c.8-4.2 3.3-6.2 7.5-6.2s6.7 2 7.5 6.2"/></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></>,
    heart: <path d="M20.5 9.3c0 5.1-8.5 10-8.5 10s-8.5-4.9-8.5-10A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.5 3.2Z"/>,
    pin: <><path d="M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.2"/></>,
    walk: <><circle cx="13" cy="4.5" r="2"/><path d="m10 21 1-6-3-3 2.5-4 4 2 3 1M11 15l5 6"/></>,
    bell: <><path d="M6 17h12l-1.5-2V10a4.5 4.5 0 0 0-9 0v5Z"/><path d="M10 20h4"/></>,
    chevron: <path d="m9 5 7 7-7 7"/>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[name]}</svg>;
}

export default function MobileArtMap({ initialPlaces, initialArtistId }: { initialPlaces: ArtistPlace[]; initialArtistId?: string }) {
  const places = initialPlaces;
  const initialPlace = Math.max(0, places.findIndex((place) => place.id === initialArtistId));
  const [tab, setTab] = useState<Tab>(initialArtistId ? "map" : "home");
  const [category, setCategory] = useState("전체");
  const [selectedPlace, setSelectedPlace] = useState(initialPlace);
  const [saved, setSaved] = useState<string[]>([]);
  const [editingSaved, setEditingSaved] = useState(false);
  const categories = ["전체", ...new Set(places.flatMap((place) => place.categories))].slice(0, 5);
  const visiblePlaces = useMemo(() => category === "전체" ? places : places.filter((place) => place.categories.includes(category)), [category, places]);
  const useGeoMap = places.length > 0 && places.every((place) => !!place.geoPosition);
  const geoPlaces = useMemo(() => visiblePlaces.flatMap((place): MapPlace[] => place.geoPosition ? [{ id: place.id, name: place.name, category: "attraction", ...place.geoPosition }] : []), [visiblePlaces]);
  const savedPlaces = places.filter((place) => saved.includes(place.id));
  const selected = places[selectedPlace];
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setSaved((JSON.parse(localStorage.getItem(SAVED_ARTISTS_KEY) || "[]") as unknown[]).filter((id): id is string => typeof id === "string" && places.some((place) => place.id === id))); } catch {}
    });
    return () => window.clearTimeout(timer);
  }, [places]);
  const toggleSaved = (id: string) => setSaved((items) => { const next = items.includes(id) ? items.filter((item) => item !== id) : [...items, id]; localStorage.setItem(SAVED_ARTISTS_KEY, JSON.stringify(next)); return next; });
  const showPlace = (id: string) => { const index = places.findIndex((place) => place.id === id); if (index >= 0) { setSelectedPlace(index); setTab("map"); } };
  const selectCategory = (item: string) => { setCategory(item); const first = item === "전체" ? places[0] : places.find((place) => place.categories.includes(item)); if (first) setSelectedPlace(places.indexOf(first)); };

  return <div className="art-map-page">
    <div className="art-map-phone">
      <span className="phone-speaker" aria-hidden="true"/>
      <main className={`visitor-app visitor-app--${tab}`}>
        {tab === "home" && <>
          <header className="home-header">
            <button className="location-button" type="button"><span className="brand-wordmark">GAMCHEON ARTISTS</span><strong>감천문화마을 <small>⌄</small></strong></button>
            <button className="icon-button" type="button" aria-label="알림"><Icon name="bell"/><i/></button>
          </header>

          <button className="search-box" type="button" onClick={() => setTab("map")}><Icon name="search"/><span>작가, 작품, 장소를 검색해보세요</span></button>
          <div className="area-row"><button type="button"><Icon name="pin"/>감천동 전체</button><button type="button">거리순 ⌄</button></div>
          <div className="category-row" aria-label="카테고리">{categories.map((item) => <button className={category === item ? "is-active" : ""} type="button" key={item} onClick={() => selectCategory(item)}>{item}</button>)}</div>

          <section className="discovery-section">
            <div className="discovery-heading"><div><span>GAMCHEON ARTISTS</span><h1>참여 작가와 작업실</h1></div><small>승인 정보 기준</small></div>
            <div className="ranking-list">{visiblePlaces.slice(0, 3).map((place, index) => <article className="ranking-card" key={place.id}>
              <strong className="rank-number">{index + 1}</strong>
              <button className="rank-thumb" type="button" onClick={() => showPlace(place.id)} aria-label={`${place.name} 지도에서 보기`}><img src={place.image} alt=""/></button>
              <div className="rank-copy"><span>{place.type}</span><strong>{place.name}</strong><small>{place.studio} · {place.visitType}</small></div>
              <button className={`save-button ${saved.includes(place.id) ? "is-saved" : ""}`} type="button" onClick={() => toggleSaved(place.id)} aria-label={`${place.name} 저장`}><Icon name="heart"/></button>
            </article>)}{!visiblePlaces.length && <p className="empty-state">현재 공개 중인 승인 작가가 없습니다.</p>}</div>
          </section>

          <section className="walk-section"><div className="section-title"><div><span>CURATED WALK</span><h2>테마별 골목 산책</h2></div><button type="button" onClick={() => setTab("map")}>전체 보기</button></div><div className="walk-cards"><button type="button" onClick={() => setTab("map")}><img src="/assets/clone/hero-artist-studio.png" alt=""/><span>35분</span><strong>작가의 작업실을<br/>따라 걷기</strong></button><button type="button" onClick={() => setTab("map")}><img src="/assets/clone/artist-goods.png" alt=""/><span>50분</span><strong>작품과 골목을<br/>함께 만나기</strong></button></div></section>
        </>}

        {tab === "map" && <section className="map-page">
          <header className="map-header"><button className="map-search" type="button"><Icon name="search"/><span>감천 아트맵 검색</span></button><button className="map-route-button" type="button" aria-label="산책 코스"><Icon name="walk"/></button></header>
          <div className="map-filter-row">{categories.map((item) => <button className={category === item ? "is-active" : ""} type="button" key={item} onClick={() => selectCategory(item)}>{item}</button>)}</div>
          <div className={`village-map${useGeoMap ? " has-live-map" : ""}`} aria-label="감천문화마을 탐색 지도">
            {useGeoMap ? <ArtistMapFrame className="village-map__frame" title="감천 작가 지도" places={geoPlaces} selectedId={selected?.id} onSelect={showPlace}/> : <>
            <img className="village-map__image" src="/gamcheon-map-concept.png" alt=""/>
            <span className="district district-a">감천문화마을</span><span className="district district-b">감내어울터</span>
            <i className="street street-a"/><i className="street street-b"/><i className="street street-c"/><i className="street street-d"/>
            {visiblePlaces.filter((place) => place.position).map((place, index) => <button style={{ left: `${place.position!.x}%`, top: `${place.position!.y}%` }} className={`map-marker ${selected?.id === place.id ? "is-selected" : ""}`} type="button" key={place.id} onClick={() => showPlace(place.id)}><span>{index + 1}</span><strong>{place.name}</strong></button>)}
            {!visiblePlaces.some((place) => place.position) && <p className="map-location-notice">승인 작가의 정확한 지도 위치를 확인하고 있습니다.</p>}
            <div className="map-controls"><button type="button" aria-label="지도 설정">◇</button><button type="button" aria-label="저장 장소"><Icon name="heart"/></button><button type="button" onClick={() => places[0] && setSelectedPlace(0)} aria-label="감천문화마을 중심으로 이동">◎</button></div></>}
          </div>
          <article className="place-sheet"><div className="sheet-handle"/><div className="sheet-area"><button type="button"><Icon name="pin"/>감천동 전체 ⌄</button><span>DB 연동</span></div><div className="sheet-title"><div><span>승인된 참여 작가</span><strong>{visiblePlaces.length}명</strong></div><Link href="/artists">전체 목록</Link></div>{selected ? <><div className="sheet-place"><img className="place-sheet__thumb" src={selected.image} alt=""/><div className="place-sheet__copy"><span>{selected.type}</span><h2>{selected.name}</h2><p><Icon name="pin"/>{selected.studio} · {selected.hours}</p></div><button className={`save-button ${saved.includes(selected.id) ? "is-saved" : ""}`} type="button" onClick={() => toggleSaved(selected.id)} aria-label="작가 저장"><Icon name="heart"/></button></div><Link className="artist-detail-link" href={selected.detailHref}>작가와 작품 자세히 보기 <span>→</span></Link></> : <p className="sheet-empty">현재 공개 중인 승인 작가가 없습니다.</p>}</article>
        </section>}

        {tab === "my" && <section className="sub-page my-page">
          <header className="sub-header my-header"><span>MY GAMCHEON</span><h1>마이페이지</h1><p>마음에 든 작가를 모아 나만의 감천 산책을 만들어보세요.</p></header>
          <div className={`saved-map${useGeoMap ? " has-live-map" : ""}`}>{useGeoMap ? <ArtistMapFrame className="saved-map__frame" title="저장한 작가 지도" places={savedPlaces.flatMap((place): MapPlace[] => place.geoPosition ? [{ id: place.id, name: place.name, category: "attraction", ...place.geoPosition }] : [])} onSelect={showPlace}/> : <><img src="/gamcheon-map-concept.png" alt=""/><div className="saved-map__dots">{savedPlaces.filter((place) => place.position).map((place) => <i key={place.id} style={{ left: `${place.position!.x}%`, top: `${place.position!.y}%` }}/>)}</div></>}<div className="saved-map__shade"/><strong>나의 감천 예술 지도</strong><span>저장한 작가 {savedPlaces.length}명</span></div>
          <div className="my-stats"><div><span>저장한 작가</span><strong>{savedPlaces.length}</strong></div><div><span>지도에 표시</span><strong>{savedPlaces.filter((place) => useGeoMap ? place.geoPosition : place.position).length}</strong></div><button type="button" onClick={() => setTab("map")}>지도 열기 <Icon name="chevron"/></button></div>
          <div className="section-title saved-heading"><div><span>MY ARTISTS</span><h2>저장한 작가</h2></div>{savedPlaces.length > 0 && <button type="button" onClick={() => setEditingSaved((value) => !value)}>{editingSaved ? "완료" : "편집"}</button>}</div>
          <div className="saved-list">{savedPlaces.length ? savedPlaces.map((place) => <div className="saved-artist-row" key={place.id}><button type="button" onClick={() => showPlace(place.id)}><img className="saved-list__thumb" src={place.image} alt=""/><span><strong>{place.name}</strong><small>{place.type} · {place.studio}</small></span><Icon name="chevron"/></button>{editingSaved && <button className="saved-remove" type="button" onClick={() => toggleSaved(place.id)} aria-label={`${place.name} 저장 삭제`}>삭제</button>}</div>) : <div className="saved-empty"><span>♡</span><strong>아직 저장한 작가가 없어요</strong><p>작가 프로필의 하트를 누르면<br/>이곳에서 다시 만날 수 있어요.</p><button type="button" onClick={() => setTab("home")}>작가 둘러보기</button></div>}</div>
        </section>}

        {tab === "menu" && <section className="sub-page">
          <header className="sub-header"><span>GAMCHEON GUIDE</span><h1>메뉴</h1></header>
          <div className="menu-grid">{[["작가와 작품", "감천의 예술가를 소개해요"], ["추천 산책", "시간별 코스를 골라보세요"], ["행사와 전시", "오늘 열리는 소식이에요"], ["이용 안내", "주차와 화장실을 확인해요"]].map(([title, copy], index) => <button type="button" key={title}><span>0{index + 1}</span><strong>{title}</strong><small>{copy}</small><Icon name="chevron"/></button>)}</div>
          <div className="menu-list"><button type="button">공지사항 <Icon name="chevron"/></button><button type="button">서비스 소개 <Icon name="chevron"/></button><button type="button">문의하기 <Icon name="chevron"/></button></div>
        </section>}
      </main>

      <nav className="bottom-nav" aria-label="주요 메뉴">
        {(["home", "map", "my", "menu"] as Tab[]).map((id) => <button className={tab === id ? "is-active" : ""} type="button" key={id} onClick={() => setTab(id)}><Icon name={id}/><span>{{home:"홈", map:"지도", my:"마이페이지", menu:"메뉴"}[id]}</span></button>)}
      </nav>
    </div>
  </div>;
}

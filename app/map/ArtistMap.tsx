"use client";

import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { artists, filterArtists } from "./artists";
import "./map.css";

export default function ArtistMap() {
  const [selected, setSelected] = useState("01");
  const [field, setField] = useState("전체");
  const [query, setQuery] = useState("");
  const [connections, setConnections] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [story, setStory] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const visible = filterArtists(query, field);
  const artist = visible.find(a => a.id === selected) ?? visible[0];

  function selectArtist(id: string, center = false) {
    setSelected(id);
    setStory(false);
    if (center && viewport.current) {
      const pin = viewport.current.querySelector<HTMLElement>(`[data-pin="${id}"]`);
      if (pin) viewport.current.scrollTo({ left: pin.offsetLeft - viewport.current.clientWidth / 2, top: pin.offsetTop - viewport.current.clientHeight / 2, behavior: "smooth" });
    }
  }

  return <div className="gm-app">
    <header className="gm-header">
      <a className="gm-brand" href="/" aria-label="감천 작가 지도 홈"><span className="gm-brand-icon">ㄱㅊ</span><span>감천 작가 지도<small>GAMCHEON ART MAP</small></span></a>
      <nav aria-label="주 메뉴"><a className="gm-current" href="/map" aria-current="page">작가 지도</a><a href="/apply">작가 참여</a><a href="/artist">내 정보</a></nav>
      <span className="gm-edition">감천의 사람, 공간, 이야기 <span>↗</span></span>
    </header>
    <main className="gm-main">
      <div className="gm-intro"><div><p className="gm-location">부산 <span>›</span> 사하구 <span>›</span> 감천2동 문화마을</p><h1>골목에서 만나는 작가들<span>.</span></h1><p className="gm-subtitle">마음에 드는 작가를 눌러 작업실과 작품을 만나보세요.</p></div><div className="gm-demo"><span>CONCEPT 01</span><strong>작가 지도 시안</strong><small>가상의 작가 6명 · 예시 위치</small></div></div>
      <div className="gm-workspace">
        <aside className="gm-sidebar" aria-label="작가 탐색">
          <div className="gm-search"><span aria-hidden="true">⌕</span><input aria-label="작가, 작업실, 작품 검색" placeholder="작가, 작업실, 작품 찾기" value={query} onChange={e => {setQuery(e.target.value); setStory(false);}} />{query && <button aria-label="검색 지우기" onClick={() => setQuery("")}>×</button>}</div>
          <div className="gm-filters" aria-label="작업 분야">{["전체", "회화", "도예", "섬유", "설치", "사진"].map(item => <button key={item} aria-pressed={field === item} onClick={() => {setField(item); setStory(false);}}>{item}</button>)}</div>
          <div className="gm-list-heading"><h2>작가의 공간</h2><span>{visible.length.toString().padStart(2,"0")}</span></div>
          <div className="gm-artist-list">{visible.map(a => <button key={a.id} className={`gm-artist ${artist?.id === a.id ? "is-selected" : ""}`} onClick={() => selectArtist(a.id, true)} aria-pressed={artist?.id === a.id} style={{"--artist":a.color} as CSSProperties}><span className="gm-avatar">{a.name.slice(0,1)}<small>{a.id}</small></span><span className="gm-artist-copy"><strong>{a.name} <small>{a.field}</small></strong><span>{a.studio}</span></span><span className="gm-chevron">↗</span></button>)}</div>
          {!visible.length && <div className="gm-empty"><strong>일치하는 작가가 없어요.</strong><p>다른 이름이나 분야로 찾아보세요.</p><button onClick={() => {setField("전체");setQuery("");}}>전체 작가 보기</button></div>}
          <div className="gm-sidebar-note"><span>ⓘ</span><p>작가명·작품·작업실은 모두 예시입니다. 실제 운영 정보는 아직 연결되지 않았어요.</p></div>
        </aside>
        <section className="gm-map-section" aria-label="감천 작가 일러스트 지도">
          <div className="gm-map-toolbar"><span><i /> 감천문화마을 <small>예시 지도</small></span><button aria-pressed={connections} onClick={() => setConnections(!connections)}><span>{connections ? "●" : "○"}</span> 작가–작품 연결</button></div>
          <div className="gm-map-viewport" ref={viewport} tabIndex={0} aria-label="지도 영역. 확대 후 스크롤하거나 방향키로 이동할 수 있습니다.">
            <div className="gm-map-canvas" style={{width:`${zoom * 100}%`}}>
              <img className="gm-map-art" src="/gamcheon-map-concept.png" alt="층층이 이어진 알록달록한 집과 골목을 표현한 감천마을 상상 일러스트. 실제 지형과 위치는 다릅니다." draggable={false} />
              {artist && connections && <svg className="gm-connection" viewBox="0 0 1000 667" aria-hidden="true"><path d={`M ${artist.x*10} ${artist.y*6.67} Q ${(artist.x+artist.wx)*5+35} ${artist.y*6.67} ${artist.wx*10} ${artist.wy*6.67}`} fill="none" stroke="white" strokeWidth="7"/><path d={`M ${artist.x*10} ${artist.y*6.67} Q ${(artist.x+artist.wx)*5+35} ${artist.y*6.67} ${artist.wx*10} ${artist.wy*6.67}`} fill="none" stroke={artist.color} strokeWidth="3" strokeDasharray="6 7"/></svg>}
              {visible.map(a => <button key={a.id} data-pin={a.id} className={`gm-map-pin ${artist?.id === a.id ? "is-active" : ""}`} style={{left:`${a.x}%`,top:`${a.y}%`,"--artist":a.color} as CSSProperties} onClick={() => selectArtist(a.id)} aria-label={`${a.name}, ${a.field}, ${a.studio} 상세 보기`} aria-pressed={artist?.id === a.id}><span className="gm-pin-number">{a.id}</span><span><strong>{a.name}</strong><small>{a.studio}</small></span><span className="gm-pin-arrow">↗</span></button>)}
              {artist && connections && <button className="gm-work-pin" style={{left:`${artist.wx}%`,top:`${artist.wy}%`,"--artist":artist.color} as CSSProperties} onClick={() => setStory(true)} aria-label={`${artist.work} 작품 이야기 보기`}><span>◇</span>{artist.work}</button>}
              <span className="gm-map-caption">GAMCHEON<br/><strong>ART VILLAGE</strong></span>
            </div>
          </div>
          <div className="gm-map-bottom"><span>상상 지도 · 실제 위치와 다릅니다.<br/>점선은 작가–작품 연결이며 보행 경로가 아닙니다.</span><div className="gm-zoom"><button aria-label="지도 축소" disabled={zoom <= 1} onClick={() => setZoom(z => Math.max(1, z-.25))}>−</button><button aria-label="지도 배율 초기화" onClick={() => {setZoom(1);viewport.current?.scrollTo({left:0,top:0});}}>{Math.round(zoom*100)}%</button><button aria-label="지도 확대" disabled={zoom >= 2} onClick={() => setZoom(z => Math.min(2,z+.25))}>＋</button></div></div>
        </section>
      </div>
      <section className="gm-detail" aria-label="선택한 작가 상세" aria-live="polite">
        {artist ? <><div className="gm-detail-title"><span className="gm-detail-index" style={{color:artist.color}}>{artist.id}</span><div><p>ARTIST & SPACE <span>예시 프로필</span></p><h2>{artist.name}<span>{artist.field}</span></h2><p>{artist.studio}</p></div></div><div className="gm-detail-story"><h3>{story ? artist.work : artist.intro}</h3><p>{story ? artist.story : `대표 작품 「${artist.work}」 · ${artist.material}`}</p><button aria-expanded={story} onClick={() => setStory(!story)}>{story ? "소개 접기 −" : "작가와 작품 이야기 읽기 ↗"}</button></div><div className="gm-visit"><span>방문 정보 확인 전</span><p>실제 주소와 관람 가능 여부는<br/>작가 등록 후 제공됩니다.</p><a href="https://map.naver.com/p/search/%EA%B0%90%EC%B2%9C%EB%AC%B8%ED%99%94%EB%A7%88%EC%9D%84" target="_blank" rel="noopener noreferrer">문화마을 실제 지도 보기 ↗</a></div></> : <p>작가를 검색하거나 분야를 바꾸면 이곳에서 이야기를 볼 수 있어요.</p>}
      </section>
      <footer className="gm-footer"><span>감천 작가 지도 <span>―</span> 골목마다, 한 사람의 세계.</span><span>2.5D 콘셉트 · 실제 길안내용이 아닙니다.</span></footer>
    </main>
  </div>;
}

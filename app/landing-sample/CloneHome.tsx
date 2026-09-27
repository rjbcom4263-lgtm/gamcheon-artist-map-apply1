"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { chooseLoaderVariant, goods, heroSlides, loaderBrandLines, news, partners, site } from "./content";

type HomeStat = readonly [string, number, string];

function Counter({ value }: { value: number }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      const started = performance.now();
      const draw = (now: number) => {
        const progress = Math.min(1, (now - started) / 1100);
        node.textContent = Math.round(value * (1 - Math.pow(1 - progress, 3))).toLocaleString("ko-KR");
        if (progress < 1) frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
      observer.disconnect();
    }, { threshold: .5 });
    observer.observe(node);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [value]);
  return <strong ref={ref}>0</strong>;
}

function Arrow() { return <span aria-hidden="true">↗</span>; }

export default function CloneHome({ user, stats }: { user: { role: "admin" | "artist" } | null; stats: HomeStat[] }) {
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loaderVariant, setLoaderVariant] = useState<"classic" | "studio" | null>(null);
  const [slide, setSlide] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [goodsTab, setGoodsTab] = useState(0);
  const [film, setFilm] = useState<number | null>(null);
  const goodsTrack = useRef<HTMLDivElement>(null);
  const goodsTabs = ["작가 작품", "아트 굿즈", "지역 프로젝트", "전시·체험", "브랜드 협업"];

  useEffect(() => {
    document.body.classList.add("clone-active");
    const timers = [window.setTimeout(() => setLoaderVariant(chooseLoaderVariant(Math.random())), 0), window.setTimeout(() => setProgress(38), 100), window.setTimeout(() => setProgress(76), 420), window.setTimeout(() => setProgress(100), 760), window.setTimeout(() => setLoaded(true), 1120)];
    return () => { document.body.classList.remove("clone-active"); timers.forEach(clearTimeout); };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timer = window.setInterval(() => setSlide((current) => (current + 1) % heroSlides.length), 5600);
    return () => clearInterval(timer);
  }, [loaded]);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(".clone-reveal"));
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add("is-visible")), { threshold: .14, rootMargin: "0px 0px -8%" });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && (setFilm(null), setMenuOpen(false));
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const selectGoods = (index: number) => {
    setGoodsTab(index);
    const track = goodsTrack.current;
    if (track) track.scrollTo({ left: index * (track.scrollWidth / goods.length), behavior: "smooth" });
  };

  return <main className="clone-page">
    <div className={`clone-loader ${loaderVariant ? `is-${loaderVariant}` : ""} ${loaded ? "is-done" : ""}`} aria-hidden="true">
      <div className="clone-loader-classic"><b>{site.brand}</b><small>{site.subBrand}</small></div>
      <div className="clone-loader-mark">{loaderBrandLines(site.brand).map((line) => <b key={line}>{line}</b>)}<small>{site.subBrand}</small></div><span>{String(progress).padStart(3, "0")}</span><i style={{ transform: `scaleX(${progress / 100})` }} />
    </div>

    <header className="clone-header">
      <Link className="clone-brand" href="/"><b>{site.brand}</b><small>{site.subBrand}</small></Link>
      <nav className="clone-desktop-nav" aria-label="주요 메뉴">{site.nav.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}</nav>
      <div className="clone-utility">{user ? <>{user.role === "admin" ? <details className="clone-account-menu"><summary>내 정보</summary><div><Link href="/admin">관리자 페이지</Link><Link href="/admin?view=accounts">작가 페이지</Link></div></details> : <Link href="/artist">내 정보</Link>}<a href={user.role === "admin" ? "/api/admin/logout" : "/api/auth/logout"}>로그아웃</a></> : <><Link href="/login">로그인</Link><Link href="/signup">회원가입</Link></>}<button aria-label="검색">⌕</button></div>
      <button className={`clone-menu-button ${menuOpen ? "is-open" : ""}`} aria-label="메뉴" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><i /><i /></button>
    </header>

    <aside className={`clone-mobile-menu ${menuOpen ? "is-open" : ""}`}>{site.nav.map(([label, href], index) => <Link key={label} href={href} onClick={() => setMenuOpen(false)}><span>0{index + 1}</span>{label}</Link>)}<div className="clone-mobile-auth">{user ? <>{user.role === "admin" ? <><Link href="/admin">관리자 페이지</Link><Link href="/admin?view=accounts">작가 페이지</Link></> : <Link href="/artist">내 정보</Link>}<a href={user.role === "admin" ? "/api/admin/logout" : "/api/auth/logout"}>로그아웃</a></> : <><Link href="/login">로그인</Link><Link href="/signup">회원가입</Link></>}</div><Link className="clone-mobile-apply" href="/apply">작가 참여 신청 <Arrow /></Link></aside>

    <section className="clone-hero" aria-label="주요 프로젝트">
      {heroSlides.map((item, index) => <article key={item.title} className={`clone-hero-slide ${slide === index ? "is-active" : ""}`} aria-hidden={slide !== index}>
        <img src={item.image} alt="" style={{ objectPosition: item.position }} /><div className="clone-hero-shade" />
        <div className="clone-hero-copy"><p>{item.eyebrow}</p><h1>{item.title.split("\n").map((line) => <span key={line}>{line}</span>)}</h1><div><span>{item.text}</span><Link href="/apply">작가 참여 신청 <Arrow /></Link></div></div>
      </article>)}
      <div className="clone-hero-controls"><span>{String(slide + 1).padStart(2, "0")}</span><div>{heroSlides.map((_, index) => <button key={index} aria-label={`${index + 1}번 슬라이드`} className={slide === index ? "is-active" : ""} onClick={() => setSlide(index)} />)}</div><span>{String(heroSlides.length).padStart(2, "0")}</span></div>
      <div className="clone-scroll-hint">SCROLL <i /></div>
    </section>

    <section className="clone-impact" id="impact">
      <img src="/assets/clone/hero-artist-studio.png" alt="작업실에서 작품을 제작하는 작가" /><div className="clone-impact-shade" />
      <div className="clone-impact-copy clone-reveal"><p>GAMCHEON ARTIST MAP</p><h2>지나치는 감천에서<br />작가를 만나러 오는 감천으로.</h2><span>감천 아티스트맵은 장소를 나열하는 지도가 아니라, 지역 작가·공방·작품을 중심으로 관광객의 실제 방문과 새로운 경험을 연결하는 로컬 문화관광 플랫폼입니다.</span><div className="clone-impact-phases"><article><b>01</b><strong>작가·공방 기록</strong><small>작품, 작업실, 방문 정보를 한곳에 담습니다.</small></article><article><b>02</b><strong>지도·QR 연결</strong><small>현재 위치에서 작가의 공간으로 안내합니다.</small></article><article><b>03</b><strong>Art Passport</strong><small>방문과 작품의 이야기를 다시 기록합니다.</small></article><article><b>04</b><strong>협업 확장</strong><small>전시·체험·굿즈·기관 협업으로 이어갑니다.</small></article></div><div><Link href="/artists">작가 소개</Link><Link href="/apply">작가로 참여하기 <Arrow /></Link></div></div>
      <em>2026–NOW</em>
      <div className="clone-stat-grid">{stats.map(([label, value, unit]) => <div key={label}><span>{label}</span><p><Counter value={value} /><small>{unit}</small></p></div>)}</div>
    </section>

    <section className="clone-section clone-news" id="news">
      <div className="clone-section-head clone-reveal"><div><p>GAMCHEON NEWS</p><h2>감천 작가 프로젝트의<br />새로운 소식을 전해요!</h2><span>작가 모집과 작품 아카이빙, 지역 협업 프로젝트의 진행 상황을 확인해보세요.</span></div><Link href="/news">소식 더보기 <Arrow /></Link></div>
      <div className="clone-news-grid">{news.map(([category, title, date, image], index) => <article className="clone-reveal" style={{ transitionDelay: `${index * 80}ms` }} key={title}><div><img src={image} alt="" /><span>{category}</span></div><h3>{title}</h3><time>{date}</time></article>)}</div>
    </section>

    <section className="clone-platform" id="platform">
      <div className="clone-platform-art clone-reveal"><img src="/gamcheon-map-concept.png" alt="감천 작가 지도 콘셉트" /><i>ART<br />PASSPORT</i></div>
      <div className="clone-platform-copy clone-reveal"><p>GAMCHEON ART PASSPORT</p><h2>작가의 공간을 방문하고<br />작품의 이야기를 수집하세요.</h2><span>작가 지도와 아트 패스포트는 골목의 작업실을 찾고, 작가와 작품을 더 가까이 만나는 지역 문화 경험입니다.</span><div><Link href="/map">작가 지도 보기 <Arrow /></Link><Link href="/passport">ART PASSPORT 보기 <Arrow /></Link></div></div>
    </section>

    <section className="clone-section clone-goods" id="artists">
      <div className="clone-section-head clone-reveal"><div><p>ARTIST &amp; PROJECTS</p><h2>작가의 작업이 더 많은<br />일상과 만날 수 있도록</h2><span>대표 작품과 작가의 언어를 기록하고 전시·체험·상품·브랜드 협업으로 연결합니다.</span></div><Link href="/apply">작가 참여 신청 <Arrow /></Link></div>
      <div className="clone-tabs">{goodsTabs.map((label, index) => <button key={label} className={goodsTab === index ? "is-active" : ""} onClick={() => selectGoods(index)}>{label}</button>)}</div>
      <div className="clone-goods-track" ref={goodsTrack}>{goods.map(([category, title, image, position]) => <article key={title}><div><img src={image} alt="" style={{ objectPosition: position }} /></div><span>{category}</span><h3>{title}</h3></article>)}</div>
      <Link className="clone-more" href="/apply">더 많은 작가 만나보기 <Arrow /></Link>
    </section>

    <section className="clone-voices">
      <div className="clone-section-head clone-reveal"><div><p>ARTIST VOICES</p><h2>작가와 지역이 함께 만든<br />생생한 이야기입니다.</h2></div></div>
      <div className="clone-voice-row"><article><b>“</b><p>내 작업을 처음 보는 사람에게 제대로 소개할 수 있는 페이지가 생긴다는 것이 가장 기대돼요.</p><span>참여 작가 인터뷰 · 2026</span></article><article><b>“</b><p>골목을 걷다가 우연히 만난 작품이 여행의 가장 오래 남는 기억이 되었습니다.</p><span>프로젝트 방문자 · 2026</span></article><article><b>“</b><p>지역의 작가와 브랜드가 함께 성장할 수 있는 협업을 찾고 있습니다.</p><span>파트너 인터뷰 · 2026</span></article></div>
    </section>

    <section className="clone-video clone-section">
      <div className="clone-section-head clone-reveal"><div><p>GAMCHEON STORIES</p><h2>영상으로 작가와<br />작업실을 만나보세요.</h2><span>작품이 만들어지는 순간과 감천에서 살아가는 창작자의 이야기를 기록합니다.</span></div><Link href="#video">채널로 이동 <Arrow /></Link></div>
      <div className="clone-video-grid" id="video"><article className="clone-reveal"><img src="/assets/clone/hero-artist-studio.png" alt="작가 작업실" /><button aria-label="작가 작업실 스토리 재생" onClick={() => setFilm(0)}>▶</button><div><span>ARTIST FILM 01</span><h3>골목 끝 작업실에서 시작된 이야기</h3></div></article><article className="clone-reveal"><img src="/assets/clone/artist-goods.png" alt="작가 작품과 상품" /><button aria-label="작가 협업 스토리 재생" onClick={() => setFilm(1)}>▶</button><div><span>PROJECT FILM 02</span><h3>작품이 사람의 일상과 만나는 순간</h3></div></article></div>
    </section>

    <section className="clone-partners clone-section" id="partners"><div className="clone-section-head clone-reveal"><div><p>PARTNERS &amp; CLIENTS</p><h2>감천의 작가를 함께<br />응원하고 연결합니다.</h2><span>전시, 아트 큐레이션, 상품 제작, 지역 캠페인 협업을 제안해주세요.</span></div><Link href="/contact">협업 문의 <Arrow /></Link></div><div className="clone-partner-grid">{partners.map((partner) => <span key={partner}>{partner}</span>)}</div></section>

    <section className="clone-apply"><div className="clone-reveal"><p>JOIN THE PROJECT</p><h2>당신의 작업과 이야기를<br />감천에서 들려주세요.</h2><Link href="/apply">작가 참여 신청하기 <Arrow /></Link></div></section>

    <footer className="clone-footer"><div className="clone-brand"><b>{site.brand}</b><small>{site.subBrand}</small></div><div><p>새김 | 감천 작가 프로젝트</p><p>비즈니스 문의 rjbcom4263@gmail.com</p><p>부산광역시 감천문화마을</p></div><div><Link href="/project">프로젝트 소개</Link><Link href="/artists">작가 소개</Link><Link href="/map">작가 지도</Link></div><small>© 2026 GAMCHEON ARTISTS. ALL RIGHTS RESERVED.</small></footer>
    <Link className="clone-chat" href="/apply"><span>작가님,<br />함께할까요?</span><b>문의하기 <Arrow /></b></Link>
    {film !== null && <div className="clone-film" role="dialog" aria-modal="true" aria-label="작가 스토리 프리뷰" onClick={() => setFilm(null)}><button aria-label="닫기" onClick={() => setFilm(null)}>×</button><article onClick={(event) => event.stopPropagation()}><img src={film === 0 ? "/assets/clone/hero-artist-studio.png" : "/assets/clone/artist-goods.png"} alt="" /><div><span>{film === 0 ? "ARTIST FILM 01" : "PROJECT FILM 02"}</span><h3>{film === 0 ? "골목 끝 작업실에서 시작된 이야기" : "작품이 사람의 일상과 만나는 순간"}</h3><p>{film === 0 ? "작가의 하루와 작품이 완성되는 과정을 사진과 글로 먼저 만나보세요." : "작품이 전시와 일상의 물건으로 확장되는 프로젝트를 소개합니다."}</p></div></article></div>}
  </main>;
}

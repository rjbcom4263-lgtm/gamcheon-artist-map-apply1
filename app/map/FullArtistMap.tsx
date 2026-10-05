"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import ArtistMapFrame, { type MapPlace } from "./ArtistMapFrame";
import type { ArtistPlace } from "./map-artists";
import "./full-art-map.css";

// 사이트의 "지도" 화면입니다. 감천 골목지도(3D 거리·장소 목록·길찾기)를 화면 전체로 보여 주고,
// 위쪽 바에서 홈으로 돌아가거나 고른 작가의 상세 페이지로 갈 수 있습니다.
export default function FullArtistMap({ initialPlaces, initialArtistId }: { initialPlaces: ArtistPlace[]; initialArtistId?: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(initialArtistId ?? null);
  const mapped = useMemo(() => initialPlaces.filter((place) => place.geoPosition), [initialPlaces]);
  const mapPlaces = useMemo(() => mapped.map((place): MapPlace => ({
    id: place.id,
    name: place.name,
    category: "attraction",
    ...place.geoPosition!,
    address: `${place.studio} · ${place.address}`,
    description: `${place.type} · ${place.hours} · ${place.visitType}`,
  })), [mapped]);
  const selected = mapped.find((place) => place.id === selectedId);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    // 고른 작가를 주소에 남겨 공유하거나 새로고침해도 같은 작가가 열리게 합니다.
    const url = new URL(window.location.href);
    if (mapped.some((place) => place.id === id)) url.searchParams.set("artist", id);
    else url.searchParams.delete("artist");
    window.history.replaceState(null, "", url);
  }, [mapped]);

  return <div className="full-art-map">
    <header className="full-art-map__bar">
      <Link className="full-art-map__brand" href="/" aria-label="감천 작가 지도 홈으로">
        <span aria-hidden="true">←</span>
        <strong>감천 작가 지도</strong>
      </Link>
      <span className="full-art-map__count">지도에 표시된 작가 {mapped.length}명{initialPlaces.length > mapped.length ? ` · 위치 확인 중 ${initialPlaces.length - mapped.length}명` : ""}</span>
      <nav className="full-art-map__links" aria-label="지도 바로가기">
        {selected && <Link className="full-art-map__detail" href={selected.detailHref}>{selected.name} 작가 자세히 보기 →</Link>}
        <Link href="/artists">작가 목록</Link>
      </nav>
    </header>
    <ArtistMapFrame full className="full-art-map__frame" title="감천 골목지도" places={mapPlaces} selectedId={selectedId} onSelect={select}/>
  </div>;
}

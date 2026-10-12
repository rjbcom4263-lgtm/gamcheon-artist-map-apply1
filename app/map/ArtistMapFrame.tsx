"use client";

import { useEffect, useRef } from "react";
import { MAP_APP_ORIGIN } from "./map-app";

// 감천 골목지도 앱(별도 서버)의 공개 지도입니다. 지도와 지도 데이터(골목길·건물 편집)는 그 앱이 맡고, 이 사이트는
// 승인된 작가 위치를 넘겨주기만 합니다. 메시지는 이 주소하고만 주고받습니다.

export type MapPlace = { id: string; name: string; category: "shop" | "attraction"; latitude: number; longitude: number; address?: string; description?: string };

type Props = {
  places: MapPlace[];
  selectedId?: string | null;
  canPick?: boolean;
  onPick?: (longitude: number, latitude: number) => void;
  onSelect?: (id: string) => void;
  title: string;
  className?: string;
  // 패널(장소 목록·길찾기)까지 갖춘 감천 골목지도 전체 화면으로 엽니다. host=site: 휴대폰에서 지도 쪽 이름표를
  // 숨기고 이 사이트의 제목 카드(FullArtistMap)가 지도 위에 대신 뜹니다.
  full?: boolean;
};

export default function ArtistMapFrame({ places, selectedId = null, canPick = false, onPick, onSelect, title, className, full = false }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const send = () => frame.current?.contentWindow?.postMessage({ source: "gamcheon-artist-host", type: "set", places, selectedId, canPick }, MAP_APP_ORIGIN);
    const receive = (event: MessageEvent) => {
      if (event.origin !== MAP_APP_ORIGIN || event.source !== frame.current?.contentWindow || event.data?.source !== "gamcheon-artist-map") return;
      if (event.data.type === "ready") send();
      if (event.data.type === "select" && typeof event.data.id === "string") onSelect?.(event.data.id);
      if (event.data.type === "pick" && Number.isFinite(event.data.longitude) && Number.isFinite(event.data.latitude)) onPick?.(event.data.longitude, event.data.latitude);
    };
    window.addEventListener("message", receive);
    send();
    return () => window.removeEventListener("message", receive);
  }, [places, selectedId, canPick, onPick, onSelect]);

  // 지도는 다른 주소(지도 앱)라, 내 위치와 휴대폰 방향(나침반) 센서를 쓰도록 따로 허락합니다.
  return <iframe ref={frame} className={className} title={title} src={full ? `${MAP_APP_ORIGIN}/?mode=full&host=site` : `${MAP_APP_ORIGIN}/`} allow="geolocation; accelerometer; gyroscope; magnetometer" />;
}

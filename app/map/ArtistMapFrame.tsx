"use client";

import { useEffect, useRef } from "react";

// 감천 골목지도 공개 지도(/map-app/, art-map 저장소에서 npm run export:site로 넣음)를 띄웁니다. 이 사이트가 승인된
// 작가 위치를 넘겨주고, 메시지는 같은 사이트 주소하고만 주고받습니다.
export const MAP_APP_PATH = "/map-app/";

// 작가 지도(full)는 목록·상세에 쓸 값(공방·분야·운영 상태·사진·작가 페이지)을 함께 보냅니다. 지도는 이 사이트 안 주소만 받습니다.
export type MapPlace = {
  id: string; name: string; category: "shop" | "attraction"; latitude: number; longitude: number; address?: string; description?: string;
  studio?: string; tags?: string[]; hours?: string; status?: { state: string; label: string }; photo?: string; href?: string; approximate?: boolean;
};

type Props = {
  places: MapPlace[];
  selectedId?: string | null;
  canPick?: boolean;
  onPick?: (longitude: number, latitude: number) => void;
  // 지도에서 장소를 고르면 그 id, 고른 장소를 닫으면 null
  onSelect?: (id: string | null) => void;
  // 지도의 '작가 보기' 버튼
  onOpen?: (id: string) => void;
  title: string;
  className?: string;
  // 패널(장소 목록·길찾기)까지 갖춘 감천 골목지도 전체 화면으로 엽니다(작가 지도 /map).
  full?: boolean;
  compactApp?: boolean;
};

export default function ArtistMapFrame({ places, selectedId = null, canPick = false, onPick, onSelect, onOpen, title, className, full = false, compactApp = false }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  // 콜백은 ref로 들고 있어 부모가 렌더마다 새 함수를 넘겨도 effect가 다시 돌지 않습니다.
  const onPickRef = useRef(onPick);
  const onSelectRef = useRef(onSelect);
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onPickRef.current = onPick;
    onSelectRef.current = onSelect;
    onOpenRef.current = onOpen;
  });

  useEffect(() => {
    const origin = window.location.origin;
    const send = () => frame.current?.contentWindow?.postMessage({ source: "gamcheon-artist-host", type: "set", places, selectedId, canPick }, origin);
    const receive = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== frame.current?.contentWindow || event.data?.source !== "gamcheon-artist-map") return;
      if (event.data.type === "ready") send();
      if (event.data.type === "select" && (typeof event.data.id === "string" || event.data.id === null)) onSelectRef.current?.(event.data.id);
      if (event.data.type === "open" && typeof event.data.id === "string") onOpenRef.current?.(event.data.id);
      if (event.data.type === "pick" && Number.isFinite(event.data.longitude) && Number.isFinite(event.data.latitude)) onPickRef.current?.(event.data.longitude, event.data.latitude);
    };
    window.addEventListener("message", receive);
    send();
    return () => window.removeEventListener("message", receive);
    // 콜백은 ref로 읽으므로 의존성에서 뺍니다. 부모가 인라인 함수를 넘겨도 지도에 상태를 다시 보내지 않습니다.
  }, [places, selectedId, canPick]);

  // 지도 안에서 내 위치와 휴대폰 방향(나침반) 센서를 쓰도록 허락합니다.
  return <iframe ref={frame} className={className} title={title} src={full ? `${MAP_APP_PATH}?mode=full&host=${compactApp ? 'compact' : 'site'}` : MAP_APP_PATH} allow="geolocation; accelerometer; gyroscope; magnetometer" />;
}

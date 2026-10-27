"use client";

import { useEffect, useRef } from "react";

// 감천 골목지도 공개 지도(/map-app/, art-map 저장소에서 npm run export:site로 넣음)를 띄웁니다. 이 사이트가 승인된
// 작가 위치를 넘겨주고, 메시지는 같은 사이트 주소하고만 주고받습니다.
export const MAP_APP_PATH = "/map-app/";

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
  compactApp?: boolean;
};

export default function ArtistMapFrame({ places, selectedId = null, canPick = false, onPick, onSelect, title, className, full = false, compactApp = false }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  // 콜백은 ref로 들고 있어 부모가 렌더마다 새 함수를 넘겨도 effect가 다시 돌지 않습니다.
  const onPickRef = useRef(onPick);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onPickRef.current = onPick;
    onSelectRef.current = onSelect;
  });

  useEffect(() => {
    const origin = window.location.origin;
    const send = () => frame.current?.contentWindow?.postMessage({ source: "gamcheon-artist-host", type: "set", places, selectedId, canPick }, origin);
    const receive = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== frame.current?.contentWindow || event.data?.source !== "gamcheon-artist-map") return;
      if (event.data.type === "ready") send();
      if (event.data.type === "select" && typeof event.data.id === "string") onSelectRef.current?.(event.data.id);
      if (event.data.type === "pick" && Number.isFinite(event.data.longitude) && Number.isFinite(event.data.latitude)) onPickRef.current?.(event.data.longitude, event.data.latitude);
    };
    window.addEventListener("message", receive);
    send();
    return () => window.removeEventListener("message", receive);
    // onPick/onSelect는 ref로 읽으므로 의존성에서 뺍니다. 부모가 인라인 함수를 넘겨도 지도에 상태를 다시 보내지 않습니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, selectedId, canPick]);

  // 지도 안에서 내 위치와 휴대폰 방향(나침반) 센서를 쓰도록 허락합니다.
  return <iframe ref={frame} className={className} title={title} src={full ? `${MAP_APP_PATH}?mode=full&host=${compactApp ? 'compact' : 'site'}` : MAP_APP_PATH} allow="geolocation; accelerometer; gyroscope; magnetometer" />;
}

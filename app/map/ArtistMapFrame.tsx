"use client";

import { useEffect, useRef } from "react";

export type MapPlace = { id: string; name: string; category: "shop" | "attraction"; latitude: number; longitude: number };

type Props = {
  places: MapPlace[];
  selectedId?: string | null;
  canPick?: boolean;
  onPick?: (longitude: number, latitude: number) => void;
  onSelect?: (id: string) => void;
  title: string;
  className?: string;
};

export default function ArtistMapFrame({ places, selectedId = null, canPick = false, onPick, onSelect, title, className }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const send = () => frame.current?.contentWindow?.postMessage({ source: "gamcheon-artist-host", type: "set", places, selectedId, canPick }, window.location.origin);
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow || event.data?.source !== "gamcheon-artist-map") return;
      if (event.data.type === "ready") send();
      if (event.data.type === "select" && typeof event.data.id === "string") onSelect?.(event.data.id);
      if (event.data.type === "pick" && Number.isFinite(event.data.longitude) && Number.isFinite(event.data.latitude)) onPick?.(event.data.longitude, event.data.latitude);
    };
    window.addEventListener("message", receive);
    send();
    return () => window.removeEventListener("message", receive);
  }, [places, selectedId, canPick, onPick, onSelect]);

  return <iframe ref={frame} className={className} title={title} src="/artist-map-embed/embed.html" />;
}

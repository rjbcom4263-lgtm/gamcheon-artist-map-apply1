"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Map as LibreMap, Marker, StyleSpecification } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapData, MapFeature } from "../../map/geo";

type Point = [number, number];
const BOUNDS: [[number, number], [number, number]] = [[129.006, 35.09274], [129.0135, 35.0992]];
const CENTER: Point = [(BOUNDS[0][0] + BOUNDS[1][0]) / 2, (BOUNDS[0][1] + BOUNDS[1][1]) / 2];

function feature(points: Point[]) {
  const coordinates = points.length >= 3 ? [...points, points[0]] : points;
  return { type: "FeatureCollection" as const, features: coordinates.length >= 2 ? [{ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates } }] : [] };
}

export default function BoundaryEditor() {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LibreMap | null>(null);
  const maplibre = useRef<typeof import("maplibre-gl") | null>(null);
  const markers = useRef<Marker[]>([]);
  const pointsRef = useRef<Point[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const drawingRef = useRef(false);
  const [status, setStatus] = useState("저장된 경계를 불러오는 중입니다.");

  function update(next: Point[]) {
    pointsRef.current = next;
    setPoints(next);
    const source = map.current?.getSource("boundary") as import("maplibre-gl").GeoJSONSource | undefined;
    source?.setData(feature(next));
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];
    if (map.current) {
      const lib = maplibre.current;
      if (!lib) return;
      next.forEach((point, index) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "boundary-handle";
        el.setAttribute("aria-label", `경계 지점 ${index + 1} 이동`);
        const marker = new lib.Marker({ element: el, draggable: true }).setLngLat(point).addTo(map.current!);
        marker.on("dragend", () => {
          const position = marker.getLngLat();
          const changed = [...pointsRef.current];
          changed[index] = [position.lng, position.lat];
          pointsRef.current = changed;
          setPoints(changed);
          (map.current?.getSource("boundary") as import("maplibre-gl").GeoJSONSource | undefined)?.setData(feature(changed));
        });
        markers.current.push(marker);
      });
    }
  }

  function setDrawMode(value: boolean) {
    drawingRef.current = value;
    setDrawing(value);
    if (map.current) map.current.getCanvas().style.cursor = value ? "crosshair" : "grab";
    setStatus(value ? "경계 그리기 중 · 외곽선을 따라 지도에서 점을 찍어주세요." : "지도 이동 모드입니다. 경계선을 추가하려면 버튼을 누르세요.");
  }

  useEffect(() => {
    let alive = true;
    let current: LibreMap | undefined;
    const addedFacilityMarkers: Marker[] = [];
    const controller = new AbortController();
    async function initialize() {
      const lib = await import("maplibre-gl");
      maplibre.current = lib;
      lib.setWorkerUrl(workerUrl);
      const response = await fetch("/api/admin/map-boundary", { cache: "no-store" });
      if (!response.ok) throw new Error("경계를 불러오지 못했습니다. 관리자 로그인을 확인해주세요.");
      const data = await response.json() as { coordinates?: Point[] };
      if (!alive || !container.current) return;
      const coordinates = Array.isArray(data.coordinates) ? data.coordinates : [];
      pointsRef.current = coordinates;
      setPoints(coordinates);
      const style: StyleSpecification = { version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": "#f4f3ea" } }] };
      if (!alive || !container.current) return;
      current = new lib.Map({ container: container.current, style, center: CENTER, zoom: 16, minZoom: 13, maxZoom: 21, maxBounds: BOUNDS, attributionControl: false });
      map.current = current;
      current.addControl(new lib.NavigationControl(), "top-right");
      current.addControl(new lib.AttributionControl({ compact: true, customAttribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>' }), "bottom-right");
      current.on("load", () => {
        current!.fitBounds(BOUNDS, { padding: 60, duration: 0 });
        current!.addSource("boundary", { type: "geojson", data: feature(pointsRef.current) });
        current!.addLayer({ id: "boundary-line", type: "line", source: "boundary", paint: { "line-color": "#e75d3e", "line-width": 4, "line-dasharray": [1.5, 1] } });
        current!.on("click", (event) => {
          if (!drawingRef.current) return;
          if (pointsRef.current.length >= 200) return setStatus("경계 지점은 최대 200개까지 추가할 수 있습니다.");
          update([...pointsRef.current, [event.lngLat.lng, event.lngLat.lat]]);
          setStatus("지점을 추가했습니다. 꼭짓점을 드래그해 다듬을 수 있어요.");
        });
        update(pointsRef.current);
        fetch("/map-data/gamcheon.geojson").then((res) => {
          if (!res.ok) throw new Error("OSM 자료");
          return res.json() as Promise<MapData>;
        }).then((data) => {
          if (!alive || !current) return;
          const bounds = data.features.filter((item) => item.geometry.type === "Point" && item.properties.kind === "place" && ["viewpoint", "artwork", "attraction", "gallery", "museum", "information"].includes(item.properties.tourism) && item.geometry.coordinates[0] >= BOUNDS[0][0] && item.geometry.coordinates[0] <= BOUNDS[1][0] && item.geometry.coordinates[1] >= BOUNDS[0][1] && item.geometry.coordinates[1] <= BOUNDS[1][1]) as MapFeature[];
          const roads = data.features.filter((item) => item.geometry.type === "LineString" && item.properties.kind === "road" && !["service", "track"].includes(item.properties.highway)) as MapFeature[];
          current!.addSource("osm-roads", { type: "geojson", data: { type: "FeatureCollection", features: roads } });
          current!.addLayer({ id: "osm-paths", type: "line", source: "osm-roads", filter: ["!", ["in", ["get", "highway"], ["literal", ["steps"]]]], paint: { "line-color": "#9ba99b", "line-width": ["interpolate", ["linear"], ["zoom"], 14, 1, 19, 2.5] } });
          current!.addLayer({ id: "osm-steps", type: "line", source: "osm-roads", filter: ["==", ["get", "highway"], "steps"], paint: { "line-color": "#d78a4a", "line-width": 2, "line-dasharray": [1, 1.3] } });
          const labels: Record<string, string> = { viewpoint: "전망대", artwork: "작품", attraction: "명소", gallery: "갤러리", museum: "박물관", information: "안내소" };
          for (const item of bounds) {
            if (item.geometry.type !== "Point") continue;
            const kind = item.properties.tourism;
            const el = document.createElement("span");
            el.className = `boundary-facility boundary-facility-${kind}`;
            el.textContent = ({ viewpoint: "전", artwork: "작", attraction: "명", gallery: "갤", museum: "박", information: "안" } as Record<string, string>)[kind] || "시";
            const title = item.properties.name ? `${labels[kind] || "시설"} · ${item.properties.name}` : labels[kind] || "시설";
            el.title = `${title} · OpenStreetMap`;
            el.setAttribute("aria-label", title);
            addedFacilityMarkers.push(new lib.Marker({ element: el, anchor: "center" }).setLngLat(item.geometry.coordinates as Point).addTo(current!));
          }
          setReady(true);
          setBusy(false);
          setStatus(coordinates.length ? `저장된 경계 ${coordinates.length}개 지점 · 주요 시설만 표시 중` : "1. 경계선 추가 시작  2. 지도에서 외곽 점 찍기  3. 경계 저장");
        }).catch(() => {
          if (!alive) return;
          setReady(true);
          setBusy(false);
          setStatus("OSM 주요 시설 자료를 불러오지 못했습니다. 경계는 그릴 수 있지만 시설 표시는 없습니다.");
        });
      });
    }
    initialize().catch((error) => { if (alive) { setBusy(false); setStatus(error instanceof Error ? error.message : "지도를 불러오지 못했습니다."); } });
    return () => { alive = false; controller.abort(); markers.current.forEach((marker) => marker.remove()); addedFacilityMarkers.forEach((marker) => marker.remove()); current?.remove(); map.current = null; };
  }, []);

  async function save(next = points) {
    if (next.length > 0 && next.length < 3) return setStatus("경계를 저장하려면 지점을 3개 이상 추가해주세요.");
    setBusy(true);
    setStatus("경계를 저장하는 중입니다.");
    try {
      const response = await fetch("/api/admin/map-boundary", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ coordinates: next }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "저장에 실패했습니다.");
      setDrawMode(false);
      setStatus(next.length ? `경계 ${next.length}개 지점을 저장했습니다. 사용자 지도에는 아직 적용되지 않았습니다.` : "저장된 경계를 지웠습니다.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "저장에 실패했습니다."); }
    finally { setBusy(false); }
  }

  return <main className="boundary-page">
    <header className="boundary-header"><div><p>GAMCHEON ARTIST MAP</p><h1>지도 구역 경계</h1><span>외곽선을 직접 그리고 저장합니다. 지금은 관리자 화면에만 저장됩니다.</span></div><Link href="/admin/map">지도 관리 홈</Link></header>
    <section className="boundary-panel"><div className="boundary-howto"><strong>경계 추가 방법</strong><span>① 경계선 추가 시작 → ② 외곽을 따라 지도 클릭 → ③ 꼭짓점을 끌어 조정 → ④ 저장</span><small>지도에는 OSM 주요 시설과 골목길만 표시합니다.</small></div><div className="boundary-tools"><div><strong>{points.length}개 지점</strong><span>{drawing ? "그리기 중 · 지도 바깥선을 클릭하세요" : "지도 이동 중 · 그리기를 시작하려면 오른쪽 버튼을 누르세요"}</span></div><div><button className="boundary-draw-button" disabled={!ready || busy} aria-pressed={drawing} onClick={() => setDrawMode(!drawing)}>{drawing ? "그리기 취소" : "경계선 추가 시작"}</button><button disabled={!points.length || busy} onClick={() => { update(points.slice(0, -1)); setStatus("마지막 지점을 되돌렸습니다."); }}>되돌리기</button><button disabled={!points.length || busy} onClick={() => { update([]); setStatus("경계를 비웠습니다. 저장하면 기존 경계가 삭제됩니다."); }}>모두 지우기</button></div></div>
      <div className="boundary-map" ref={container} aria-label="경계선을 그리는 OpenStreetMap 지도" />
      <footer className="boundary-footer"><p role="status" aria-live="polite">{status}</p><button disabled={!ready || busy || (points.length > 0 && points.length < 3)} onClick={() => void save()}>{busy ? "저장 중…" : "경계 저장"}</button></footer>
    </section>
  </main>;
}

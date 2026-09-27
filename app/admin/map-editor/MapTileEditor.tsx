"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Tile = { id: string; zoom: number; tile_x: number; tile_y: number; object_key: string; source: string; active: number; created_at: string };

export default function MapTileEditor() {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [zoom, setZoom] = useState("18");
  const [tileX, setTileX] = useState("");
  const [tileY, setTileY] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("감천 작가 지도를 위한 차분한 에디토리얼 아트맵 스타일. 차콜 블랙, 따뜻한 아이보리, 소프트 그레이, 일렉트릭 블루를 사용하고 평면적인 2D 지도 그래픽으로 표현합니다.");
  const [status, setStatus] = useState("캡처한 카카오 타일을 선택해 업로드할 수 있습니다.");
  const [busy, setBusy] = useState(false);

  async function loadTiles() {
    const response = await fetch("/api/admin/map-tiles", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { tiles?: Tile[] };
    setTiles(data.tiles || []);
  }
  useEffect(() => { void loadTiles(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!image) return setStatus("먼저 캡처한 타일 이미지를 선택해주세요.");
    setBusy(true); setStatus("타일을 저장하는 중입니다.");
    const form = new FormData();
    form.set("zoom", zoom); form.set("tileX", tileX); form.set("tileY", tileY); form.set("image", image);
    const response = await fetch("/api/admin/map-tiles", { method: "POST", body: form });
    const data = await response.json().catch(() => ({})) as { error?: string };
    setBusy(false);
    if (!response.ok) return setStatus(data.error || "타일 저장에 실패했습니다.");
    setStatus("타일을 저장했습니다. 공개 지도 연결 단계에서 이 좌표를 교체할 수 있습니다.");
    setImage(null); setTileX(""); setTileY("");
    const input = document.getElementById("map-tile-file") as HTMLInputElement | null;
    if (input) input.value = "";
    await loadTiles();
  }

  async function generate(event: FormEvent) {
    event.preventDefault();
    if (!image) return setStatus("먼저 캡처한 타일 이미지를 선택해주세요.");
    setBusy(true); setStatus("MuAPI에서 타일 스타일을 변환하는 중입니다. 시간이 조금 걸릴 수 있습니다.");
    const form = new FormData();
    form.set("zoom", zoom); form.set("tileX", tileX); form.set("tileY", tileY); form.set("prompt", prompt); form.set("image", image);
    const response = await fetch("/api/admin/map-tiles/generate", { method: "POST", body: form });
    const data = await response.json().catch(() => ({})) as { error?: string };
    setBusy(false);
    if (!response.ok) return setStatus(data.error || "AI 타일 변환에 실패했습니다.");
    setStatus("AI 스타일 타일을 저장했습니다.");
    setImage(null); setTileX(""); setTileY("");
    const input = document.getElementById("map-tile-file") as HTMLInputElement | null;
    if (input) input.value = "";
    await loadTiles();
  }

  return <main className="map-editor-page">
    <header className="map-editor-header"><div><p>GAMCHEON ARTIST MAP</p><h1>지도 타일 편집</h1><span>카카오 타일을 캡처해 선택한 영역만 우리 지도에 교체합니다.</span></div><Link href="/admin/map">지도 관리</Link></header>
    <section className="map-editor-grid">
      <article className="map-editor-card map-editor-guide">
        <div className="map-editor-eyebrow">01 / CAPTURE</div>
        <h2>카카오 타일 캡처</h2>
        <p>외부 캡처 도구에서 감천 지역을 이동하고, 저장할 타일을 선택한 뒤 PNG로 내려받습니다.</p>
        <a className="map-editor-primary" href="https://kakao-tile-map.web.app/" target="_blank" rel="noopener noreferrer">카카오 타일 캡처 도구 열기 ↗</a>
        <ol><li>지도를 감천문화마을로 이동합니다.</li><li>캡처할 타일을 선택합니다.</li><li>타일의 z/x/y 좌표와 PNG 파일을 확인합니다.</li><li>오른쪽 폼에 좌표와 이미지를 업로드합니다.</li></ol>
        <small>이 도구는 브라우저 화면 캡처 권한을 요청할 수 있습니다. 현재 탭을 선택해야 캡처가 진행됩니다.</small>
      </article>
      <article className="map-editor-card">
        <div className="map-editor-eyebrow">02 / REPLACE</div>
        <h2>교체 타일 저장</h2>
        <form onSubmit={submit} className="map-editor-form">
          <label>Zoom<input value={zoom} onChange={(event) => setZoom(event.target.value)} inputMode="numeric" required /></label>
          <label>X<input value={tileX} onChange={(event) => setTileX(event.target.value)} inputMode="numeric" placeholder="예: 233000" required /></label>
          <label>Y<input value={tileY} onChange={(event) => setTileY(event.target.value)} inputMode="numeric" placeholder="예: 105000" required /></label>
          <label className="map-editor-file">캡처 이미지<input id="map-tile-file" type="file" accept="image/png,image/jpeg" onChange={(event) => setImage(event.target.files?.[0] || null)} required /></label>
          <label className="map-editor-prompt">AI 스타일 프롬프트<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} /></label>
          <div className="map-editor-submit-row"><button type="submit" disabled={busy}>{busy ? "저장 중…" : "원본 타일 저장"}</button><button type="button" className="map-editor-ai-button" disabled={busy} onClick={generate}>{busy ? "변환 중…" : "AI 스타일로 변환"}</button></div>
        </form>
        <p className="map-editor-status" role="status">{status}</p>
      </article>
    </section>
    <section className="map-editor-card map-editor-list"><div className="map-editor-list-head"><div><div className="map-editor-eyebrow">03 / SAVED TILES</div><h2>저장된 교체 타일</h2></div><span>{tiles.length}개</span></div>{tiles.length ? <div className="map-editor-tile-list">{tiles.map((tile) => <div key={tile.object_key} className="map-editor-tile"><img src={`/api/map-tiles/${tile.zoom}/${tile.tile_x}/${tile.tile_y}`} alt="저장된 지도 타일" /><div><strong>z{tile.zoom} · x{tile.tile_x} · y{tile.tile_y}</strong><small>{tile.source}</small></div><a href={`/api/map-tiles/${tile.zoom}/${tile.tile_x}/${tile.tile_y}`} target="_blank" rel="noopener noreferrer">보기 ↗</a></div>)}</div> : <p className="map-editor-empty">아직 저장된 교체 타일이 없습니다.</p>}</section>
  </main>;
}

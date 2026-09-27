"use client";

/* eslint-disable @next/next/no-img-element -- R2 image URLs are dynamic and already validated by the image API. */
import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import ArtistMapFrame, { type MapPlace } from "../../map/ArtistMapFrame";
import "./public-artists.css";

export type ManagedArtist = { id: string; artist_name: string; payload_json: string; image_keys_json: string; created_at: string };
type Payload = { values?: Record<string, unknown>; categories?: string[] };
type ImageRecord = { type?: string; key?: string };
type AddressSuggestion = { address: string; longitude: number; latitude: number };

function parse<T>(value: string, fallback: T): T { try { return JSON.parse(value) as T; } catch { return fallback; } }
function details(row: ManagedArtist) {
  const payload = parse<Payload>(row.payload_json, {});
  const values = payload.values || {};
  const images = parse<ImageRecord[]>(row.image_keys_json, []);
  const profile = images.find((image) => image.type === "profile" && image.key)?.key;
  const x = Number(values.mapX);
  const y = Number(values.mapY);
  const longitude = Number(values.mapLongitude);
  const latitude = Number(values.mapLatitude);
  const positioned = Number.isFinite(longitude) && Number.isFinite(latitude) && longitude >= 128.9998 && longitude <= 129.0174 && latitude >= 35.0867 && latitude <= 35.1023;
  return {
    categories: payload.categories?.join(" · ") || "분야 미입력",
    studio: typeof values.studioName === "string" && values.studioName.trim() ? values.studioName : "공방명 미입력",
    address: typeof values.address === "string" && values.address.trim() ? values.address.trim() : typeof values.studioAddress === "string" ? values.studioAddress.trim() : "",
    published: values.mapPublished !== false,
    longitude: positioned ? longitude : null,
    latitude: positioned ? latitude : null,
    legacyPosition: Number.isFinite(x) && Number.isFinite(y) && x >= 5 && x <= 95 && y >= 12 && y <= 78,
    image: profile ? `/api/admin/images?key=${encodeURIComponent(profile)}` : "",
  };
}

export default function PublicArtistManager({ initial, adminName, initialSelectedId }: { initial: ManagedArtist[]; adminName: string; initialSelectedId?: string }) {
  const [rows, setRows] = useState(initial);
  const [savedPayloads, setSavedPayloads] = useState(() => Object.fromEntries(initial.map((row) => [row.id, row.payload_json])));
  const [selectedId, setSelectedId] = useState(() => initial.find((row) => row.id === initialSelectedId)?.id || initial.find((row) => details(row).longitude === null)?.id || initial[0]?.id || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [placing, setPlacing] = useState(false);
  const [pointMenuOpen, setPointMenuOpen] = useState(false);
  const [addressQueries, setAddressQueries] = useState<Record<string, string>>({});
  const [addressSearch, setAddressSearch] = useState<{ artistId: string; suggestions: AddressSuggestion[] } | null>(null);
  const [addressMessage, setAddressMessage] = useState<{ artistId: string; text: string } | null>(null);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const selected = rows.find((row) => row.id === selectedId);
  const selectedDetails = selected ? details(selected) : null;
  const addressQuery = selected ? addressQueries[selected.id] ?? selectedDetails?.address ?? "" : "";
  const unplacedRows = rows.filter((row) => details(row).longitude === null);
  const placedRows = rows.filter((row) => details(row).longitude !== null);
  const unsavedCount = rows.filter((row) => row.payload_json !== savedPayloads[row.id]).length;
  const selectedUnsaved = !!selected && selected.payload_json !== savedPayloads[selected.id];
  useEffect(() => {
    if (!unsavedCount) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsavedCount]);
  const counts = useMemo(() => {
    const all = rows.map(details);
    const published = all.filter((item) => item.published);
    return { approved: all.length, published: published.length, publishedPositioned: published.filter((item) => item.longitude !== null).length };
  }, [rows]);
  const mapPlaces = useMemo(() => rows.flatMap((row): MapPlace[] => {
    const item = details(row);
    return item.longitude === null || item.latitude === null ? [] : [{ id: row.id, name: row.artist_name, category: "attraction", longitude: item.longitude, latitude: item.latitude }];
  }), [rows]);

  function updateValues(changes: Record<string, unknown>) {
    setRows((current) => current.map((row) => {
      if (row.id !== selectedId) return row;
      const payload = parse<Payload>(row.payload_json, {});
      return { ...row, payload_json: JSON.stringify({ ...payload, values: { ...(payload.values || {}), ...changes } }) };
    }));
    setMessage("");
  }

  function selectArtist(id: string, fromPoint = false) {
    if (saving) return;
    setSelectedId(id);
    setPlacing(false);
    setPointMenuOpen(fromPoint);
    setAddressSearch(null);
    setAddressMessage(null);
    setMessage("");
  }

  async function findAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const artistId = selected.id;
    setSearchingAddress(true);
    setAddressMessage(null);
    setAddressSearch(null);
    try {
      const response = await fetch("/api/admin/artists/geocode", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: addressQuery }), cache: "no-store" });
      const result = await response.json() as { suggestions?: AddressSuggestion[]; error?: string };
      if (!response.ok) throw new Error(result.error || "주소를 찾지 못했습니다.");
      const suggestions = result.suggestions || [];
      setAddressSearch({ artistId, suggestions });
      if (!suggestions.length) setAddressMessage({ artistId, text: "지도 범위에서 주소를 찾지 못했습니다. 주소를 고치거나 지도에서 직접 찍어주세요." });
    } catch (error) {
      setAddressMessage({ artistId, text: error instanceof Error ? error.message : "주소를 찾지 못했습니다." });
    } finally {
      setSearchingAddress(false);
    }
  }

  async function save() {
    if (!selected || !selectedDetails) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/artists/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ published: selectedDetails.published, mapLongitude: selectedDetails.longitude, mapLatitude: selectedDetails.latitude }),
      });
      const result = await response.json() as { payload_json?: string; error?: string };
      if (!response.ok || !result.payload_json) throw new Error(result.error || "저장하지 못했습니다. 다시 시도해주세요.");
      setRows((current) => current.map((row) => row.id === selected.id ? { ...row, payload_json: result.payload_json! } : row));
      setSavedPayloads((current) => ({ ...current, [selected.id]: result.payload_json! }));
      setMessage("위치와 공개 상태를 저장했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    if (!selected) return;
    setRows((current) => current.map((row) => row.id === selected.id ? { ...row, payload_json: savedPayloads[selected.id] } : row));
    setMessage("저장 전 상태로 되돌렸습니다.");
  }

  return <div className="admin-dashboard public-artist-admin">
    <aside className="dash-sidebar">
      <Link href="/" className="dash-logo"><span>감</span><strong>감천 작가 지도</strong></Link>
      <nav>
        <div className="nav-group"><p>신청 관리</p><Link className="sidebar-link" href="/admin"><span>◆</span>신청 목록</Link></div>
        <Link className="sidebar-link" href="/admin?view=accounts"><span>●</span>계정 관리</Link>
        <div className="nav-group"><p>지도 관리</p><Link className="sidebar-link" href="/admin/map"><span>◇</span>지도 관리 홈</Link><Link className="sidebar-link active" href="/admin/artists"><span>◆</span>공개 작가 관리</Link></div>
      </nav>
      <div className="dash-sidebar-card"><strong>{adminName}</strong><span>운영자 계정</span><a href="/api/admin/logout">로그아웃</a></div>
    </aside>

    <main className="dash-main">
      <header className="dash-top">
        <div><p>GAMCHEON ARTIST MAP</p><h1>공개 작가 관리</h1></div>
        <div className="dash-actions"><Link href="/admin/map">지도 관리</Link><Link href="/map" target="_blank">공개 지도 보기</Link></div>
      </header>
      <section className="dash-metrics">
        <Metric label="승인 작가" value={counts.approved}/><Metric label="배치 대기" value={unplacedRows.length}/><Metric label="배치 완료" value={placedRows.length}/><Metric label="지도 공개" value={counts.published}/>
      </section>
      {counts.publishedPositioned < counts.published && <p className="public-map-transition">공개 작가 {counts.published}명 중 {counts.publishedPositioned}명의 새 위치가 저장되었습니다. 모두 지정하면 공개 지도도 새 지도로 전환됩니다. 그전에는 기존 그림 지도를 유지합니다.</p>}

      <section className="public-manager-grid">
        <div className="dash-card public-artist-list">
          <div className="dash-card-head"><div><h2>승인 작가·공방</h2><span>신청을 승인하면 이 목록에 자동으로 나타납니다.</span></div></div>
          {rows.length ? [
            { key: "waiting", title: "배치 안 된 작가·공방", items: unplacedRows },
            { key: "placed", title: "배치 완료 작가·공방", items: placedRows },
          ].map((group) => <section className={`public-list-group public-list-group--${group.key}`} key={group.key}>
            <div className="public-list-group-title"><strong>{group.title}</strong><span>{group.items.length}명</span></div>
            {group.items.length ? group.items.map((row) => { const item = details(row); return <button type="button" disabled={saving} className={`public-artist-entry ${row.id === selectedId ? "is-selected" : ""}`} key={row.id} onClick={() => selectArtist(row.id)}>
              {item.image ? <img src={item.image} alt=""/> : <i>{row.artist_name.slice(0, 1)}</i>}
              <span><strong>{row.artist_name}</strong><small>공방 · {item.studio}</small><em>{row.payload_json !== savedPayloads[row.id] ? "미저장 · " : ""}{group.key === "waiting" ? "배치 대기" : "배치 완료"} · {item.published ? "공개" : "숨김"}</em></span>
            </button>; }) : <p className="public-list-empty">{group.key === "waiting" ? "배치 대기 중인 작가가 없습니다." : "아직 배치된 작가가 없습니다."}</p>}
          </section>) : <div className="admin-empty">승인된 작가가 없습니다.</div>}
        </div>

        <div className="dash-card public-map-editor">
          {selected && selectedDetails ? <>
            <div className="public-editor-head"><div><span>{selectedDetails.categories}</span><h2>{selected.artist_name}</h2><p>{selectedDetails.studio}</p></div><label className="publish-switch"><input type="checkbox" disabled={saving} checked={selectedDetails.published} onChange={(event) => updateValues({ mapPublished: event.target.checked })}/><span>{selectedDetails.published ? "지도에 공개" : "지도에서 숨김"}</span></label></div>
            <div className="coordinate-fields"><span>경도 {selectedDetails.longitude?.toFixed(6) ?? "미지정"}</span><span>위도 {selectedDetails.latitude?.toFixed(6) ?? "미지정"}</span><button type="button" disabled={saving} onClick={() => { setPlacing(true); setPointMenuOpen(false); }}>{placing ? "지도에서 선택 중" : selectedDetails.longitude === null ? "지도에 배치" : "위치 변경"}</button><button type="button" disabled={saving || selectedDetails.longitude === null} onClick={() => { updateValues({ mapLongitude: null, mapLatitude: null }); setPointMenuOpen(false); setPlacing(false); }}>위치 지우기</button></div>
            <form className="artist-address-search" onSubmit={findAddress}><label>신청서 공방 주소<input value={addressQuery} onChange={(event) => setAddressQueries((current) => ({ ...current, [selected.id]: event.target.value }))} placeholder="예: 부산 사하구 감천로 123"/></label><button type="submit" disabled={searchingAddress || saving || addressQuery.trim().length < 4}>{searchingAddress ? "찾는 중…" : "주소로 위치 제안"}</button></form>
            {addressMessage?.artistId === selected.id && <p className="artist-address-message" role="status">{addressMessage.text}</p>}
            {addressSearch?.artistId === selected.id && !!addressSearch.suggestions.length && <div className="artist-address-results"><strong>검색 결과를 선택하세요</strong>{addressSearch.suggestions.map((item, index) => <button type="button" key={`${item.address}-${index}`} onClick={() => { updateValues({ mapLongitude: item.longitude, mapLatitude: item.latitude }); setPlacing(false); setPointMenuOpen(true); setAddressSearch(null); setAddressMessage({ artistId: selected.id, text: "제안 위치입니다. 지도를 확인하고 저장해주세요." }); }}>{item.address} <span>이 위치 사용</span></button>)}</div>}
            <p className="coordinate-help">{placing ? "지도에서 공방 위치를 눌러주세요. 선택 후 저장해야 반영됩니다." : "주소 제안을 선택하거나 ‘지도에 배치’를 눌러 직접 위치를 지정하세요. 점을 누르면 관리 메뉴가 열립니다."}</p>
            <div className="coordinate-map"><ArtistMapFrame title="작가 위치 지정 지도" places={mapPlaces} selectedId={selectedId} canPick={placing && !saving} onPick={(longitude, latitude) => { if (!saving && placing) { updateValues({ mapLongitude: longitude, mapLatitude: latitude }); setPlacing(false); setPointMenuOpen(true); } }} onSelect={(id) => selectArtist(id, true)}/>
              {placing && <div className="map-placement-hint">지도에서 위치를 찍어주세요 <button type="button" onClick={() => setPlacing(false)}>취소</button></div>}
              {pointMenuOpen && selectedDetails.longitude !== null && <div className="map-point-menu"><div><strong>{selected.artist_name}</strong><span>{selectedDetails.studio}</span><button type="button" aria-label="점 관리 메뉴 닫기" onClick={() => setPointMenuOpen(false)}>×</button></div><a href={`/admin/applications/${encodeURIComponent(selected.id)}`}>신청서 보기</a><button type="button" onClick={() => { setPlacing(true); setPointMenuOpen(false); }}>위치 변경</button><button type="button" onClick={() => updateValues({ mapPublished: !selectedDetails.published })}>{selectedDetails.published ? "지도에서 숨기기" : "지도에 공개하기"}</button><button type="button" disabled title="2단계에서 연결합니다">3D 공방 넣기 · 2단계</button></div>}
            </div>
            <div className="public-editor-actions"><p className={message && message !== "위치와 공개 상태를 저장했습니다." && message !== "저장 전 상태로 되돌렸습니다." ? "is-error" : ""} role="status">{message || (selectedUnsaved ? "변경사항이 아직 저장되지 않았습니다." : selectedDetails.longitude === null ? selectedDetails.legacyPosition ? "기존 그림 지도 핀은 유지됩니다. 새 지도에서 위치를 다시 지정해주세요." : "새 지도에서 작가 위치를 지정해주세요." : "위치를 확인했습니다.")}</p><div className="public-editor-buttons"><button type="button" className="public-discard" disabled={saving || !selectedUnsaved} onClick={discard}>취소</button><button type="button" disabled={saving || !selectedUnsaved} onClick={save}>{saving ? "저장 중…" : "변경사항 저장"}</button></div></div>
          </> : <div className="admin-empty">관리할 작가를 선택해주세요.</div>}
        </div>
      </section>
    </main>
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="metric-card"><span>{label}</span><strong>{value}</strong></div>; }

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import GeoMapView from "./GeoMapView";
import Village3DView from "./Village3DView";
import { scopeData } from "./village";
import { centerOf, draftError } from "./geo";
import type { ArtistDraft, MapData, MapFeature } from "./geo";
import "./gps-map.css";

export default function GpsArtistMap(){
  const [data,setData]=useState<MapData|null>(null);
  const [loadError,setLoadError]=useState("");
  const [reload,setReload]=useState(0);
  const [selected,setSelected]=useState<MapFeature|null>(null);
  const [tab,setTab]=useState<"artists"|"places"|"buildings">("artists");
  const [query,setQuery]=useState("");
  const [drafts,setDrafts]=useState<ArtistDraft[]>([]);
  const [editing,setEditing]=useState(false);
  const [pickEntrance,setPickEntrance]=useState(false);
  const [entrance,setEntrance]=useState<[number,number]|null>(null);
  const [formError,setFormError]=useState("");
  const [notice,setNotice]=useState("");
  const [removeId,setRemoveId]=useState<string|null>(null);
  const [about,setAbout]=useState(false);
  const [display,setDisplay]=useState<"3d"|"map">("3d");
  useEffect(()=>{
    if(selected && display==="map" && window.innerWidth<=720)document.querySelector(".gps-detail")?.scrollIntoView({block:"start",behavior:"smooth"});
  },[selected,display]);
  useEffect(()=>{
    const abort=new AbortController();
    fetch("/map-data/gamcheon.geojson",{signal:abort.signal}).then(r=>{if(!r.ok)throw Error("data");return r.json();}).then(result=>{
      if(result.type!=="FeatureCollection" || !Array.isArray(result.features) || !result.metadata)throw Error("invalid");
      if(!abort.signal.aborted)setData(scopeData(result));
    }).catch(e=>{if(e.name!=="AbortError")setLoadError("지역 지도 데이터를 불러오지 못했습니다. 다시 시도해 주세요.");});
    return()=>abort.abort();
  },[reload]);
  const buildings=useMemo(()=>data?.features.filter(f=>f.properties.kind==="building")??[],[data]);
  const places=useMemo(()=>data?.features.filter(f=>f.properties.kind==="place" && f.properties.name)??[],[data]);
  const steps=data?.features.filter(f=>f.properties.highway==="steps").length??0;
  const selectedDrafts=drafts.filter(d=>d.buildingId===selected?.id);
  const q=query.trim().toLocaleLowerCase("ko");
  const results=(tab==="buildings"?buildings:places).filter(f=>`${f.properties.name} ${f.properties.address} ${f.id}`.toLocaleLowerCase("ko").includes(q));
  const shownDrafts=drafts.filter(d=>`${d.name} ${d.studio} ${d.field}`.toLocaleLowerCase("ko").includes(q));
  const coords=selected?centerOf(selected):null;

  const select=useCallback((feature:MapFeature)=>{
    setSelected({...feature});setEditing(false);setEntrance(null);setPickEntrance(false);setFormError("");setNotice("");setRemoveId(null);
  },[]);
  useEffect(()=>{
    if(!data)return;
    type Tool={name:string;description:string;inputSchema:object;annotations:object;execute:(input:unknown)=>Promise<unknown>};
    const context=(document as Document&{modelContext?:{registerTool:(tool:Tool,options:{signal:AbortSignal})=>void|Promise<void>}}).modelContext;
    if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    try {void Promise.resolve(context.registerTool({name:"select_gamcheon_building",description:"Select a building in the Gamcheon Culture Village map and open its visible detail panel. This does not create or publish artist data.",inputSchema:{type:"object",properties:{buildingId:{type:"string"}},required:["buildingId"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async input=>{
      if(!input||typeof input!=="object"||typeof (input as {buildingId?:unknown}).buildingId!=="string")throw Error("buildingId is required");
      const building=data.features.find(f=>f.id===(input as {buildingId:string}).buildingId&&f.properties.kind==="building");
      if(!building)throw Error("Building is not in the village map");
      if(lifecycle.signal.aborted)throw Error("Map closed");select(building);
      await new Promise(resolve=>requestAnimationFrame(resolve));
      return {buildingId:building.id,coordinate:centerOf(building),status:"selected"};
    }},{signal:lifecycle.signal})).catch(()=>{});}catch{/* The map also works in browsers without WebMCP support. */}
    return()=>lifecycle.abort();
  },[data,select]);
  function saveDraft(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    const draft:ArtistDraft={id:crypto.randomUUID(),buildingId:String(selected?.id??""),name:String(form.get("name")??"").trim(),field:String(form.get("field")??""),studio:String(form.get("studio")??"").trim(),floor:String(form.get("floor")??"").trim(),note:String(form.get("note")??"").trim(),entrance,status:"draft"};
    const error=draftError(draft,selected??undefined);if(error){setFormError(error);return;}
    setDrafts(current=>[...current,draft]);setEditing(false);setPickEntrance(false);setEntrance(null);setTab("artists");setQuery("");setNotice("작가 초안을 건물에 연결했습니다. 새로고침 전에 ‘초안 내려받기’로 보관해 주세요.");
  }
  function exportDrafts(){
    const output={version:1,status:"unverified-draft",createdAt:new Date().toISOString(),coordinateSystem:"EPSG:4326",source:"OpenStreetMap",artists:drafts.map(d=>({...d,displayCoordinate:centerOf(buildings.find(b=>b.id===d.buildingId)!)}))};
    const url=URL.createObjectURL(new Blob([JSON.stringify(output,null,2)],{type:"application/json"}));
    const link=document.createElement("a");link.href=url;link.download="gamcheon-artist-drafts.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  return <div className="gps-app">
    <header className="gps-header"><Link className="gps-brand" href="/"><span className="gps-logo">감천<span>↗</span></span><span>작가 지도<small>GAMCHEON ART MAP</small></span></Link><nav aria-label="주 메뉴"><Link href="/map" aria-current="page">지도 탐색</Link><Link href="/apply">작가 참여</Link><button onClick={()=>setAbout(!about)} aria-expanded={about}>지도 안내</button></nav><span className="gps-header-note"><i/> 부산 사하구 · 감천2동</span></header>
    <main className="gps-main">
      <div className="gps-title-row"><div><p className="gps-eyebrow">GAMCHEON CULTURE VILLAGE / VILLAGE MAP</p><h1>감천, 골목 속 작가의 공간<span>.</span></h1><p>문화마을 주요 관광 구역과 연결 골목 · 기존 1차 구역 포함</p></div><div className="village-display-switch" aria-label="지도 화면 선택"><button aria-pressed={display==="3d"} onClick={()=>setDisplay("3d")}>3D 마을</button><button aria-pressed={display==="map"} onClick={()=>setDisplay("map")}>항공 지도</button></div></div>
      {about && <section className="gps-about"><h2>이 지도를 사용하는 방법</h2><p>마을 전체에서 확대하면 건물 윤곽을 구분할 수 있습니다. 건물을 누르고 작가 표시를 연결하세요. 작가 초안은 이 화면에서만 유지되며 실제 공개 작가 정보가 아닙니다.</p><p>현재 지도는 OpenStreetMap에 등록된 건물·길을 사용합니다. 누락된 골목, 건물 변경, 출입구와 통행 가능 여부는 현장 확인이 필요합니다. 3D 지형은 마을의 큰 경사를 보여주는 용도이며 개별 계단 높이를 판별할 수 없습니다.</p><p>‘내 위치’는 버튼을 누를 때만 기기에 위치 확인을 요청합니다. 우리 서버에 현재 위치를 저장하지 않습니다. 배경 지도와 고도 자료는 외부 지도 제공자에서 받아옵니다.</p><div><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap 출처·이용 조건 ↗</a><a href="https://mapterhorn.com/attribution" target="_blank" rel="noopener noreferrer">고도 자료 출처 ↗</a></div></section>}
      <div className="gps-workspace">
        <aside className="gps-sidebar">
          <div className="gps-search"><span aria-hidden="true">⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} aria-label="현재 목록 검색" placeholder={tab==="artists"?"작가 · 작업실 검색":tab==="buildings"?"건물 이름 · 번호 검색":"장소 이름 검색"}/>{query&&<button aria-label="검색 지우기" onClick={()=>setQuery("")}>×</button>}</div>
          <div className="gps-tabs" aria-label="탐색 대상">{([["artists","작가"],["places","마을 장소"],["buildings","건물"]] as const).map(([key,label])=><button key={key} aria-pressed={tab===key} onClick={()=>{setTab(key);setQuery("");}}>{label}</button>)}</div>
          <div className="gps-sidebar-content">
            {tab==="artists" && <><div className="gps-section-heading"><h2>작가의 공간</h2><span>{drafts.length}명 · 초안</span></div>{!drafts.length?<div className="gps-empty-artists"><span className="gps-empty-symbol">⌂<i>+</i></span><h3>작가의 공간을<br/>지도에 연결하세요.</h3><p>건물을 선택하면 작가 표시를<br/>그 건물에 연결할 수 있어요.</p><button onClick={()=>{setTab("buildings");setQuery("");}}>건물 찾아보기 <span>→</span></button><small>확인된 작가 위치가 아직 없습니다.<br/>가상의 위치는 지도에 표시하지 않습니다.</small></div>:<><p className="gps-draft-reminder">이 화면의 초안입니다. 새로고침하면 사라집니다.</p>{shownDrafts.map(d=><button className="gps-result" key={d.id} onClick={()=>{const b=buildings.find(f=>f.id===d.buildingId);if(b)select(b);}}><span className="gps-result-icon artist">{d.name[0]}</span><span><strong>{d.name}<small>{d.field}</small></strong><em>{d.studio} {d.floor&&`· ${d.floor}`}</em></span><span>↗</span></button>)}{!shownDrafts.length&&<p className="gps-no-results">일치하는 작가가 없어요.</p>}<button className="gps-download" onClick={exportDrafts}>초안 내려받기 ↓</button></>}</>}
            {tab!=="artists" && <><div className="gps-section-heading"><h2>{tab==="buildings"?"선택 가능한 건물":"지도에 등록된 장소"}</h2><span>{results.length.toLocaleString()}개</span></div><p className="gps-list-hint">{tab==="buildings"?"지도에서 건물을 직접 눌러도 선택됩니다.":"OSM 등록 정보입니다. 운영 여부는 확인이 필요해요."}</p>{results.slice(0,60).map(f=><button className={`gps-result ${selected?.id===f.id?"active":""}`} key={f.id} onClick={()=>select(f)}><span className="gps-result-icon">{tab==="buildings"?"▦":"◇"}</span><span><strong>{f.properties.name||`건물 ${String(f.id).split("/")[1]}`}</strong><em>{f.properties.address || (f.properties.kind==="place"?"문화마을 주변 · 지도 등록 장소":"출입구 미확인")}</em></span><span>↗</span></button>)}{results.length>60&&<p className="gps-list-hint">앞의 60개를 표시합니다. 이름·번호로 검색하거나 지도를 눌러 주세요.</p>}{!results.length&&<p className="gps-no-results">일치하는 항목이 없어요.</p>}</>}
          </div>
          <div className="gps-data-counts"><div><strong>{data?buildings.length.toLocaleString():"—"}</strong><span>건물 윤곽</span></div><div><strong>{data?steps:"—"}</strong><span>등록 계단 구간</span></div><button onClick={()=>setAbout(!about)} aria-label="데이터 범위 안내">ⓘ</button></div>
        </aside>
        <div className="gps-map-column">{data?(()=>{const View=display==="3d"?Village3DView:GeoMapView;return <View data={data} selected={selected} drafts={drafts} pickEntrance={pickEntrance} entrance={entrance} onSelect={select} onEntrance={point=>{setEntrance(point);setPickEntrance(false);setFormError("");document.querySelector(".gps-draft-form")?.scrollIntoView({block:"center",behavior:"smooth"});}}/>;})():<div className="gps-data-loading" role="status"><strong>{loadError||"감천의 건물과 골목을 불러오는 중입니다."}</strong>{loadError&&<button onClick={()=>{setLoadError("");setReload(n=>n+1);}}>다시 불러오기</button>}</div>}</div>
      </div>
      <section className="gps-detail" aria-label="선택한 건물 및 장소">
        {!selected?<div className="gps-selection-guide"><span>01</span><div><h2>먼저, 지도에서 건물을 눌러보세요.</h2><p>건물 윤곽이 강조되고, 해당 건물에 작가와 출입구를 연결할 수 있습니다.</p></div><span className="gps-guide-arrow">↖</span></div>:<>
          <div className="gps-detail-head"><div><p className="gps-eyebrow">{selected.properties.kind==="building"?"BUILDING & ARTIST":"PLACE IN GAMCHEON"}</p><h2>{selected.properties.name||`선택한 건물`}</h2><p>{selected.properties.address||"주소 정보 미등록"} <span>·</span> {selected.id}</p></div><button className="gps-close" onClick={()=>{setSelected(null);setEditing(false);setEntrance(null);setPickEntrance(false);}} aria-label="상세 정보 닫기">×</button></div>
          <div className="gps-detail-grid"><div className="gps-building-meta"><span className="gps-tag">{selected.properties.kind==="building"?"지도에 등록된 건물 윤곽":"OSM 등록 장소"}</span><dl><div><dt>표시 중심</dt><dd>{coords?.[1].toFixed(6)}, {coords?.[0].toFixed(6)}</dd></div>{selected.properties.kind==="building"&&<><div><dt>건물 높이</dt><dd>{selected.properties.heightSource==="osm"?`OSM 등록 ${selected.properties.height}m`:selected.properties.heightSource==="levels"?`${selected.properties.levels}층 등록 · 높이 미등록`:"미등록 · 3D에서는 시안용 높이 사용"}</dd></div><div><dt>출입구</dt><dd>현장 확인 필요</dd></div></>}</dl><a href={`https://www.openstreetmap.org/${selected.properties.osmId}`} target="_blank" rel="noopener noreferrer">원본 지도 정보 ↗</a><p className="gps-small-note">표시 중심은 출입구가 아닙니다. 방문 경로는 아직 제공하지 않습니다.</p></div>
          <div className="gps-artist-connections"><div className="gps-section-heading"><h3>이 건물의 작가</h3><span>{selectedDrafts.length}명 · 초안</span></div>{selectedDrafts.length?selectedDrafts.map(d=><div className="gps-linked-artist" key={d.id}><div><strong>{d.name}<small>{d.field}</small></strong><p>{d.studio}{d.floor&&` · ${d.floor}`}</p><p>{d.entrance?`지정한 출입구 ${d.entrance[1].toFixed(6)}, ${d.entrance[0].toFixed(6)}`:"출입구 미지정"}</p>{d.note&&<p>{d.note}</p>}</div>{removeId===d.id?<div className="gps-remove-confirm"><span>이 초안을 삭제할까요?</span><button onClick={()=>{setDrafts(ds=>ds.filter(item=>item.id!==d.id));setRemoveId(null);}}>삭제</button><button onClick={()=>setRemoveId(null)}>취소</button></div>:<button className="gps-text-button" onClick={()=>setRemoveId(d.id)}>삭제</button>}</div>):<p className="gps-unregistered">아직 연결된 작가가 없습니다.<br/>실제 작가 정보를 확인한 뒤 연결해 주세요.</p>}
          {selected.properties.kind==="building" && !editing && <button className="gps-primary" onClick={()=>{setEditing(true);setNotice("");setEntrance(null);}}>＋ 이 건물에 작가 표시 연결</button>}
          {selected.properties.kind!=="building" && <p className="gps-small-note">작가를 연결하려면 지도에서 건물 윤곽을 선택해 주세요.</p>}
          </div></div>
          {editing&&<form className="gps-draft-form" onSubmit={saveDraft}><div className="gps-section-heading"><h3>작가 표시 초안</h3><span>공개되지 않는 임시 정보</span></div><div className="gps-form-grid"><label>작가 이름<input name="name" required maxLength={50} placeholder="실제 작가 이름"/></label><label>작업 분야<select name="field"><option>회화</option><option>도예·공예</option><option>사진</option><option>설치미술</option><option>섬유</option><option>기타</option></select></label><label>작업실 이름<input name="studio" required maxLength={80} placeholder="작업실 또는 전시 공간"/></label><label>층·호수<input name="floor" maxLength={30} placeholder="예: 2층, 위쪽 골목 입구"/></label></div><label>찾아오는 방법<textarea name="note" maxLength={300} placeholder="계단, 간판, 출입문 등 확인한 내용을 적어 주세요." rows={2}/></label><div className="gps-entrance-row"><button type="button" className="gps-outline" aria-pressed={pickEntrance} onClick={()=>{setPickEntrance(p=>!p);document.querySelector(".gps-map-section")?.scrollIntoView({block:"center",behavior:"smooth"});}}>{pickEntrance?"출입구 지정 취소":"◎ 지도에서 출입구 지정"}</button><span>{entrance?`${entrance[1].toFixed(6)}, ${entrance[0].toFixed(6)} · 현장 미검증`:"출입구는 건물 중심과 별도로 지정합니다."}</span>{entrance&&<button type="button" className="gps-text-button" onClick={()=>setEntrance(null)}>지정 해제</button>}</div>{formError&&<p className="gps-form-error" role="alert">{formError}</p>}<div className="gps-form-actions"><p>초안은 새로고침하면 사라집니다. 연결 후 JSON으로 내려받을 수 있어요.</p><button className="gps-outline" type="button" onClick={()=>{setEditing(false);setPickEntrance(false);setEntrance(null);}}>취소</button><button className="gps-primary" type="submit" disabled={pickEntrance}>작가 표시 연결</button></div></form>}
          {notice&&<p className="gps-notice" role="status">{notice}</p>}
        </>}
      </section>
      <footer className="gps-footer"><span>감천 작가 지도 <b>·</b> 사람과 공간을 잇는 지도</span><span>공개 데이터 기준 {data?.metadata.osmTimestamp?.slice(0,10)||"확인 중"} <b>·</b> 건물·골목 누락 및 변경 가능 <b>·</b> 현장 검증 전</span></footer>
    </main>
  </div>;
}

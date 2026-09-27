"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Report lifecycle and selection changes from the imperative Three.js scene. */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { ArtistDraft, MapData, MapFeature } from "./geo";
import { appearanceFor, DEPTH, inArea, LANDMARKS, MAX_BUILDING_HEIGHT, toGps, toLocal, validAppearance, WIDTH } from "./village";
import type { BuildingAppearance } from "./village";
import { buildingModel, disposeObject, loadElevation, loadRoofColors, overviewFrame, roadModel, terrainModel } from "./village-scene";
import type { Elevation } from "./village-scene";
import "./village.css";

type Props={data:MapData;selected:MapFeature|null;drafts:ArtistDraft[];pickEntrance:boolean;entrance:[number,number]|null;onSelect:(f:MapFeature)=>void;onEntrance:(p:[number,number])=>void};
type Label={name:string;position:THREE.Vector3;kind:"place"|"artist"};
type Runtime={scene:THREE.Scene;camera:THREE.PerspectiveCamera;controls:OrbitControls;models:Map<string,THREE.Group>;elevation:Elevation;roofColors:Map<string,string>;refreshBuilding:(id:string)=>void;home:(top?:boolean)=>void;updatePins:()=>void;render:()=>void};
// Keep the original key: building IDs remain stable across the expanded view.
const STORAGE_KEY="gamcheon-area1-appearance-v1";

export default function Village3DView(props:Props) {
  const host=useRef<HTMLDivElement>(null),labelHost=useRef<HTMLDivElement>(null),runtime=useRef<Runtime|null>(null),latest=useRef(props);
  const overrides=useRef<Record<string,BuildingAppearance>>({});
  const [ready,setReady]=useState(false),[error,setError]=useState(""),[retry,setRetry]=useState(0),[top,setTop]=useState(false),[showPaths,setShowPaths]=useState(true),[showLabels,setShowLabels]=useState(true);
  const [terrainStatus,setTerrainStatus]=useState("지형 불러오는 중"),[colorStatus,setColorStatus]=useState("지붕 색상 불러오는 중"),[gps,setGps]=useState(""),[notice,setNotice]=useState("");
  const [appearance,setAppearance]=useState<BuildingAppearance|null>(null);
  const [editor,setEditor]=useState(false);
  const selectedId=props.selected?.properties.kind==="building"?String(props.selected.id):null;
  const gpsRequest=useRef(0);
  useEffect(()=>{latest.current=props;});

  useEffect(()=>{
    const abort=new AbortController();let destroyed=false;let frame=0;let resize:ResizeObserver|undefined;let renderer:THREE.WebGLRenderer|undefined;let controls:OrbitControls|undefined;
    const invalidateGps=()=>{gpsRequest.current++;};
    const labelNodes:HTMLDivElement[]=[];let labels:Label[]=[];
    const pointerStart=new THREE.Vector2();const raycaster=new THREE.Raycaster();let hoverId:string|null=null;
    const scene=new THREE.Scene();scene.background=new THREE.Color("#e8eef0");
    const models=new Map<string,THREE.Group>();
    let terrain:THREE.Mesh;let roads=new THREE.Group();const buildings=props.data.features.filter(f=>f.properties.kind==="building");
    const buildingById=new Map(buildings.map(f=>[String(f.id),f]));
    let markers=new THREE.Group();scene.add(markers);
    const selectionMaterial=new THREE.LineBasicMaterial({color:"#f3a92f"});
    let selection:THREE.Box3Helper|null=null;

    function updateLabels() {
      labelNodes.forEach(n=>n.remove());labelNodes.length=0;
      if(!labelHost.current)return;
      for(const label of labels) {
        const node=document.createElement("div");node.className=`village-label ${label.kind}`;node.textContent=label.name;node.title=label.name;labelHost.current.append(node);labelNodes.push(node);
      }
    }
    function highlight() {
      if(selection){scene.remove(selection);disposeObject(selection);selection=null;}
      const feature=latest.current.selected;
      const model=feature&&models.get(String(feature.id));
      if(model){selection=new THREE.Box3Helper(new THREE.Box3().setFromObject(model).expandByScalar(.35),selectionMaterial.color);scene.add(selection);}
    }
    function draw() {
      if(destroyed||!renderer||!runtime.current)return;
      const camera=runtime.current.camera;
      // Fine roof outlines help close inspection, but add unnecessary draw calls in the overview.
      const detailed=camera.position.distanceTo(runtime.current.controls.target)<400;
      for(const model of models.values()){const outline=model.getObjectByName("roof-outline");if(outline)outline.visible=detailed;}
      renderer.render(scene,camera);
      const width=host.current?.clientWidth??1,height=host.current?.clientHeight??1;
      labels.forEach((label,i)=>{
        const p=label.position.clone().project(camera),node=labelNodes[i];if(!node)return;
        node.style.visibility=p.z>1||p.z< -1||Math.abs(p.x)>1||Math.abs(p.y)>1?"hidden":"visible";
        node.style.transform=`translate(${(p.x+1)*width/2}px,${(1-p.y)*height/2}px) translate(-50%,-100%)`;
      });
    }
    function render() { cancelAnimationFrame(frame);frame=requestAnimationFrame(draw); }
    function updatePins() {
      if(!runtime.current)return;
      scene.remove(markers);disposeObject(markers);markers=new THREE.Group();scene.add(markers);
      const elevation=runtime.current.elevation;
      labels=LANDMARKS.map(p=>{const [x,z]=toLocal(p.coordinate);return {name:p.name,position:new THREE.Vector3(x,elevation(x,z)+14,z),kind:"place"};});
      for(const landmark of LANDMARKS) {
        const [x,z]=toLocal(landmark.coordinate);const dot=new THREE.Mesh(new THREE.CylinderGeometry(1.3,1.3,1,12),new THREE.MeshStandardMaterial({color:"#687e7e"}));dot.position.set(x,elevation(x,z)+1,z);markers.add(dot);
      }
      const grouped=new Map<string,ArtistDraft[]>();
      for(const draft of latest.current.drafts)grouped.set(draft.buildingId,[...(grouped.get(draft.buildingId)??[]),draft]);
      for(const [id,drafts] of grouped) {
        const model=models.get(id);if(!model)continue;
        const y=model.userData.roofY+5;
        const marker=new THREE.Mesh(new THREE.SphereGeometry(2.3,12,8),new THREE.MeshStandardMaterial({color:"#ef7c40",emissive:"#733519",emissiveIntensity:.15}));marker.position.set(model.position.x,y,model.position.z);marker.userData.buildingId=id;markers.add(marker);
        labels.push({name:drafts.length>1?`${drafts.length}명 · 작가 초안`:`${drafts[0].name} · 초안`,position:new THREE.Vector3(model.position.x,y+4,model.position.z),kind:"artist"});
      }
      if(latest.current.entrance) {
        const [x,z]=toLocal(latest.current.entrance);const dot=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.5,.6,16),new THREE.MeshStandardMaterial({color:"#f4773c"}));dot.position.set(x,elevation(x,z)+1,z);markers.add(dot);
      }
      updateLabels();highlight();render();
    }
    function getAppearance(f:MapFeature) { return overrides.current[String(f.id)]??{...appearanceFor(f),roof:runtime.current?.roofColors.get(String(f.id))??appearanceFor(f).roof}; }
    function refreshBuilding(id:string) {
      const feature=buildingById.get(id);if(!feature||!runtime.current)return;
      const previous=models.get(id);if(previous){scene.remove(previous);disposeObject(previous);}
      const model=buildingModel(feature,getAppearance(feature),runtime.current.elevation);models.set(id,model);scene.add(model);
      if(renderer)renderer.shadowMap.needsUpdate=true;
    }
    function rebuild() {
      if(!runtime.current)return;
      if(terrain){scene.remove(terrain);disposeObject(terrain);}
      terrain=terrainModel(runtime.current.elevation);scene.add(terrain);
      scene.remove(roads);disposeObject(roads);roads=roadModel(props.data.features.filter(f=>f.properties.kind==="road"),runtime.current.elevation);roads.name="roads";scene.add(roads);
      buildings.forEach(f=>refreshBuilding(String(f.id)));updatePins();
    }
    function pick(event:PointerEvent) {
      if(!renderer||!runtime.current||event.button!==0||Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>5)return;
      const rect=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),runtime.current.camera);
      if(latest.current.pickEntrance) {
        const hit=raycaster.intersectObject(terrain)[0];if(hit)latest.current.onEntrance(toGps(hit.point.x,hit.point.z));return;
      }
      const hit=raycaster.intersectObjects([...models.values(),markers],true).find(h=>h.object.userData.buildingId);
      if(hit){const feature=buildingById.get(hit.object.userData.buildingId);if(feature)latest.current.onSelect(feature);}
    }
    function hover(event:PointerEvent) {
      if(event.buttons||!renderer||!runtime.current)return;
      const rect=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),runtime.current.camera);
      const hit=raycaster.intersectObjects([...models.values()],true).find(h=>h.object.userData.buildingId);
      const id=hit?.object.userData.buildingId??null;
      if(id!==hoverId){hoverId=id;renderer.domElement.style.cursor=latest.current.pickEntrance?"crosshair":id?"pointer":"grab";}
    }
    try {
      try { const stored=JSON.parse(localStorage.getItem(STORAGE_KEY)??"{}");if(stored&&typeof stored==="object")for(const [id,value] of Object.entries(stored))if(validAppearance(value)&&buildings.some(b=>b.id===id))overrides.current[id]=value; } catch { setNotice("이 기기의 외관 설정을 읽지 못했습니다. 기본 시안으로 열었습니다."); }
      renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
      renderer.domElement.setAttribute("aria-label","감천문화마을 3D 지도. 건물 목록으로도 선택할 수 있습니다.");renderer.domElement.tabIndex=0;host.current?.append(renderer.domElement);
      const camera=new THREE.PerspectiveCamera(35,1,1,8000);controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.minDistance=25;controls.maxDistance=6000;controls.maxPolarAngle=Math.PI*.47;controls.screenSpacePanning=true;
      controls.addEventListener("change",render);
      scene.add(new THREE.HemisphereLight("#fffef5","#98b2b9",2.5));
      const extent=Math.hypot(WIDTH,DEPTH);
      const sun=new THREE.DirectionalLight("#fff3d8",3);sun.position.set(-extent*.45,extent*.9,extent*.3);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-extent*.7,right:extent*.7,top:extent*.7,bottom:-extent*.7,near:1,far:extent*2.5});sun.shadow.bias=-.0003;sun.shadow.normalBias=.3;scene.add(sun);
      const floor=new THREE.Mesh(new THREE.PlaneGeometry(6000,6000),new THREE.MeshStandardMaterial({color:"#e8eef0",roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-10;floor.receiveShadow=true;scene.add(floor);
      const slab=new THREE.Mesh(new THREE.BoxGeometry(WIDTH+1,9,DEPTH+1),new THREE.MeshStandardMaterial({color:"#a7b3af",roughness:1}));slab.position.y=-5;scene.add(slab);
      const home=(isTop=false)=>{
        if(!controls)return;
        const bounds=new THREE.Box3().setFromObject(terrain);for(const model of models.values())bounds.expandByObject(model);
        const frame=overviewFrame(bounds,camera.aspect||1,camera.fov,isTop);
        controls.maxDistance=Math.max(6000,frame.distance*1.8);camera.far=controls.maxDistance+extent;camera.updateProjectionMatrix();
        controls.target.copy(frame.target);camera.position.copy(frame.position);camera.lookAt(controls.target);controls.update();render();
      };
      runtime.current={scene,camera,controls,models,elevation:()=>0,roofColors:new Map(),refreshBuilding,home,updatePins,render};
      resize=new ResizeObserver(()=>{if(!host.current||!renderer)return;const {clientWidth:w,clientHeight:h}=host.current;renderer.setSize(w,h);camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();render();});resize.observe(host.current!);
      const w=host.current!.clientWidth,h=host.current!.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();
      renderer.domElement.addEventListener("pointerdown",e=>pointerStart.set(e.clientX,e.clientY));renderer.domElement.addEventListener("pointerup",pick);renderer.domElement.addEventListener("pointermove",hover);
      renderer.domElement.addEventListener("webglcontextlost",e=>{e.preventDefault();setError("3D 화면 연결이 중단되었습니다. 다시 불러오거나 항공 지도를 이용해 주세요.");});
      renderer.domElement.addEventListener("keydown",event=>{
        if(!controls)return;const delta=new THREE.Vector3();
        if(event.key==="ArrowLeft")delta.x=-15;else if(event.key==="ArrowRight")delta.x=15;else if(event.key==="ArrowUp")delta.z=-15;else if(event.key==="ArrowDown")delta.z=15;else if(event.key==="Home"){home();event.preventDefault();return;}else return;
        event.preventDefault();camera.position.add(delta);controls.target.add(delta);controls.update();render();
      });
      rebuild();home();setReady(true);
      void loadElevation(abort.signal).then(elevation=>{
        if(destroyed||!runtime.current)return;runtime.current.elevation=elevation;rebuild();home();setTerrainStatus("약 30m급 고도 자료 적용");
      }).catch(()=>{if(!destroyed)setTerrainStatus("지형 연결 실패 · 평지 시안으로 표시");});
      void loadRoofColors(buildings,abort.signal).then(colors=>{
        if(destroyed||!runtime.current)return;runtime.current.roofColors=colors;
        // Color changes do not change geometry or shadows; avoid rebuilding every building.
        for(const [id,color] of colors){if(overrides.current[id])continue;const roof=models.get(id)?.getObjectByName("roof");if(roof instanceof THREE.Mesh&&(roof.material instanceof THREE.MeshStandardMaterial))roof.material.color.set(color);}
        render();setColorStatus(colors.size?`${colors.size}개 지붕 · 항공사진 추정색`:"항공사진 연결 실패 · 기본 시안색");
        const selected=latest.current.selected;if(selected?.properties.kind==="building")setAppearance(getAppearance(selected));
      });
    } catch { setError("이 기기에서 3D 화면을 열지 못했습니다. 항공 지도로 전환하거나 다시 불러와 주세요."); }
    return()=>{
      destroyed=true;invalidateGps();abort.abort();cancelAnimationFrame(frame);resize?.disconnect();controls?.dispose();runtime.current=null;disposeObject(scene);selectionMaterial.dispose();renderer?.dispose();renderer?.domElement.remove();labelNodes.forEach(n=>n.remove());
    };
  },[props.data,retry]);

  useEffect(()=>{
    const rt=runtime.current;if(!rt)return;
    if(props.selected?.properties.kind==="building") {
      const id=String(props.selected.id),model=rt.models.get(id);
      setAppearance(overrides.current[id]??{...appearanceFor(props.selected),roof:rt.roofColors.get(id)??appearanceFor(props.selected).roof});
      if(model){const target=new THREE.Vector3(model.position.x,model.userData.roofY,model.position.z);const direction=rt.camera.position.clone().sub(rt.controls.target).normalize();rt.controls.target.copy(target);rt.camera.position.copy(target.clone().addScaledVector(direction,Math.min(160,rt.camera.position.distanceTo(target))));rt.controls.update();}
    } else {setAppearance(null);setEditor(false);}
    rt.updatePins();
  },[props.selected,ready]);
  useEffect(()=>{runtime.current?.updatePins();},[props.drafts,props.entrance,ready]);
  useEffect(()=>{const rt=runtime.current;if(!rt)return;const roads=rt.scene.getObjectByName("roads");if(roads)roads.visible=showPaths;rt.render();},[showPaths,terrainStatus,ready]);
  function changeAppearance(next:BuildingAppearance) {
    if(!selectedId||!validAppearance(next))return;overrides.current[selectedId]=next;setAppearance(next);runtime.current?.refreshBuilding(selectedId);runtime.current?.updatePins();
    try {localStorage.setItem(STORAGE_KEY,JSON.stringify(overrides.current));setNotice("외관 보정을 이 브라우저에 저장했습니다.");}catch{setNotice("기기 저장 공간을 사용할 수 없습니다. 아래 내려받기로 보관해 주세요.");}
  }
  function exportModels() {
    const output={version:1,scope:props.data.metadata.scope,coordinateSystem:"EPSG:4326",status:"unverified-appearance-draft",buildings:Object.entries(overrides.current).map(([buildingId,appearance])=>({buildingId,...appearance}))};
    const url=URL.createObjectURL(new Blob([JSON.stringify(output,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="gamcheon-village-appearance.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function locate() {
    if(!navigator.geolocation||!window.isSecureContext){setGps("현재 위치는 HTTPS 또는 이 컴퓨터의 로컬 주소에서 사용할 수 있습니다.");return;}
    const request=++gpsRequest.current;setGps("현재 위치 확인 중…");
    navigator.geolocation.getCurrentPosition(position=>{
      if(request!==gpsRequest.current)return;
      const rt=runtime.current;if(!rt)return;
      const point:[number,number]=[position.coords.longitude,position.coords.latitude];
      if(!inArea(point)){setGps(`현재 문화마을 표시 범위 밖입니다. 위치 오차 약 ${Math.round(position.coords.accuracy)}m. ‘항공 지도’에서 주변 위치를 볼 수 있습니다.`);return;}
      const old=rt.scene.getObjectByName("gps-location");if(old){rt.scene.remove(old);disposeObject(old);}
      const [x,z]=toLocal(point),group=new THREE.Group();group.name="gps-location";
      const disc=new THREE.Mesh(new THREE.CircleGeometry(Math.min(position.coords.accuracy,300),48),new THREE.MeshBasicMaterial({color:"#3b9eed",transparent:true,opacity:.16,depthWrite:false}));disc.rotation.x=-Math.PI/2;disc.position.set(x,rt.elevation(x,z)+.5,z);group.add(disc);
      const dot=new THREE.Mesh(new THREE.SphereGeometry(2,12,8),new THREE.MeshBasicMaterial({color:"#197bef",depthTest:false}));dot.renderOrder=10;dot.position.set(x,rt.elevation(x,z)+2,z);group.add(dot);rt.scene.add(group);rt.render();setGps(`현재 위치 · 오차 반경 약 ${Math.round(position.coords.accuracy)}m`);
    },e=>{if(request===gpsRequest.current)setGps(e.code===1?"위치 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.":"위치를 확인하지 못했습니다. 야외에서 다시 시도해 주세요.");},{enableHighAccuracy:true,timeout:15000,maximumAge:10000});
  }

  return <section className="village-view gps-map-section" aria-label="감천문화마을 확장 구역 3D 시안">
    <div ref={host} className="village-canvas"/>
    <div ref={labelHost} className={`village-labels ${showLabels?"":"hidden"}`} aria-hidden="true"/>
    <div className="village-toolbar"><div className="village-view-switch"><button disabled={!ready} aria-pressed={!top} onClick={()=>{setTop(false);runtime.current?.home(false);}}>입체 보기</button><button disabled={!ready} aria-pressed={top} onClick={()=>{setTop(true);runtime.current?.home(true);}}>위에서 보기</button></div><button disabled={!ready} onClick={()=>{runtime.current?.home(top);}}>전체 구역 ↗</button></div>
    <div className="village-area"><span>VILLAGE OVERVIEW</span><strong>감천문화마을</strong><p>문화마을과 연결 골목<br/>{props.data.features.filter(f=>f.properties.kind==="building").length.toLocaleString()}개 건물 · 기존 1차 구역 포함</p></div>
    <div className="village-options"><button aria-pressed={showPaths} onClick={()=>setShowPaths(!showPaths)}>골목 {showPaths?"켜짐":"꺼짐"}</button><button aria-pressed={showLabels} onClick={()=>setShowLabels(!showLabels)}>장소명 {showLabels?"켜짐":"꺼짐"}</button></div>
    {selectedId&&appearance&&<div className="village-selected"><div><span>선택한 건물</span><strong>{props.selected?.properties.name||`#${selectedId.split("/")[1]}`}</strong></div><button onClick={()=>setEditor(!editor)} aria-expanded={editor}>외관 보정 {editor?"−":"＋"}</button><button onClick={()=>document.querySelector(".gps-detail")?.scrollIntoView({behavior:"smooth",block:"start"})}>작가 연결 ↓</button></div>}
    {editor&&selectedId&&appearance&&<div className="village-editor"><div><strong>건물 외관 보정</strong><button aria-label="외관 보정 닫기" onClick={()=>setEditor(false)}>×</button></div><p>사진과 대조하며 조정하세요. 저장해도 현장 확인 완료로 바뀌지는 않습니다.</p><label>표시 높이 <b>{appearance.height.toFixed(1)}m</b><input type="range" min="2" max={MAX_BUILDING_HEIGHT} step=".5" value={appearance.height} onChange={e=>changeAppearance({...appearance,height:Number(e.target.value)})}/></label><div className="village-colors"><label>외벽<input type="color" value={appearance.wall} onChange={e=>changeAppearance({...appearance,wall:e.target.value})}/></label><label>지붕<input type="color" value={appearance.roof} onChange={e=>changeAppearance({...appearance,roof:e.target.value})}/></label></div><label className="village-checkbox"><input type="checkbox" checked={appearance.windows} onChange={e=>changeAppearance({...appearance,windows:e.target.checked})}/>창문 시안 표시 · 실제 배치 아님</label><button className="village-export" onClick={exportModels}>외관 보정 내려받기 ↓</button><small role="status">{notice}</small></div>}
    <div className="village-bottom-controls"><button disabled={!ready} onClick={locate}>◎ 내 위치</button><div><button aria-label="3D 지도 확대" disabled={!ready} onClick={()=>{const r=runtime.current;if(r){r.camera.position.lerp(r.controls.target,.2);r.controls.update();r.render();}}}>＋</button><button aria-label="3D 지도 축소" disabled={!ready} onClick={()=>{const r=runtime.current;if(r){r.camera.position.add(r.camera.position.clone().sub(r.controls.target).multiplyScalar(.2));r.controls.update();r.render();}}}>−</button><button aria-label="시점을 왼쪽으로 회전" disabled={!ready} onClick={()=>{const r=runtime.current;if(r){r.camera.position.sub(r.controls.target).applyAxisAngle(new THREE.Vector3(0,1,0),Math.PI/6).add(r.controls.target);r.camera.lookAt(r.controls.target);r.controls.update();r.render();}}}>↶</button></div></div>
    <div className="village-help">드래그 회전 · 우클릭 이동 · 휠 확대<span>터치: 한 손가락 회전 · 두 손가락 이동·확대</span></div>
    {props.pickEntrance&&<div className="village-prompt" role="status">출입구가 있는 골목 바닥을 눌러 주세요.</div>}
    {error&&<div className="village-error" role="alert"><p>{error}</p><button onClick={()=>{setError("");setReady(false);setRetry(n=>n+1);}}>다시 불러오기</button></div>}
    <div className="village-status"><p><b>외형 검토용 3D 시안</b> · 배치: OSM · 미확인 높이: 6m · 지붕 형태·외벽: 임시 표현</p><p>{terrainStatus} · {colorStatus}</p>{gps&&<p role="status">{gps}</p>}<div><span>문화마을 주변을 포함한 작업 범위 · 공식 경계 아님 · 길 안내 전 현장 확인 필요</span><span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a> · <a href="https://mapterhorn.com/attribution" target="_blank" rel="noreferrer">Mapterhorn</a> · <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noreferrer">Imagery © Esri, Vantor, Earthstar Geographics, GIS User Community</a></span></div></div>
  </section>;
}

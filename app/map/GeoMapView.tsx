"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as LibreMap, StyleSpecification } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { artistPoints, centerOf } from "./geo";
import { AREA, ORIGIN as VILLAGE_CENTER } from "./village";
import type { ArtistDraft, MapData, MapFeature } from "./geo";

type Props = { data:MapData;selected:MapFeature|null;drafts:ArtistDraft[];pickEntrance:boolean;entrance:[number,number]|null;onSelect:(f:MapFeature)=>void;onEntrance:(p:[number,number])=>void };
const MAP_BOUNDS:[[number,number],[number,number]]=[[AREA.west,AREA.south],[AREA.east,AREA.north]];

export default function GeoMapView(props:Props) {
  const container=useRef<HTMLDivElement>(null);
  const mapRef=useRef<LibreMap|null>(null);
  const latest=useRef(props);
  const [ready,setReady]=useState(false);
  const [mode,setMode]=useState<"2d"|"3d">("2d");
  const [basemap,setBasemap]=useState<"imagery"|"street">("imagery");
  const [imageryUnavailable,setImageryUnavailable]=useState(false);
  const [paths,setPaths]=useState(true);
  const [status,setStatus]=useState("지도와 건물 정보를 불러오는 중입니다.");
  const [gps,setGps]=useState("내 위치 버튼을 누르면 위치 권한을 요청합니다.");
  const [locating,setLocating]=useState(false);
  const [fatal,setFatal]=useState(false);
  const [retry,setRetry]=useState(0);
  const geoControl=useRef<{trigger:()=>boolean}|null>(null);
  const selectedRef=useRef<string|number|null>(null);
  const hoveredRef=useRef<string|number|null>(null);
  const imageryReadyRef=useRef(false);
  useEffect(()=>{latest.current=props;});

  useEffect(()=>{
    let alive=true;
    let map:LibreMap|undefined;
    const abort=new AbortController();
    const init=async()=>{
      const lib=await import("maplibre-gl");
      lib.setWorkerUrl(workerUrl);
      let style:StyleSpecification;
      let offlineBasemap=false;
      try {
        const response=await fetch("https://tiles.openfreemap.org/styles/positron",{signal:AbortSignal.any([abort.signal,AbortSignal.timeout(12000)])});
        if(!response.ok) throw Error("basemap");
        style=await response.json();
        // Local OSM footprints remain the single selectable building source.
        style.layers=style.layers.filter(layer=>!("source-layer" in layer && layer["source-layer"]==="building") && !layer.id.startsWith("poi"));
      } catch {
        if(!alive) return;
        offlineBasemap=true;
        style={version:8,sources:{},layers:[{id:"background",type:"background",paint:{"background-color":"#edf1ed"}}]};
        setStatus("배경지도 연결 실패 · 저장된 건물과 골목은 계속 볼 수 있습니다.");
      }
      if(!alive || !container.current) return;
      map=new lib.Map({container:container.current,style,center:VILLAGE_CENTER,zoom:18,minZoom:10,maxZoom:21,pitch:0,maxPitch:55,attributionControl:false,localIdeographFontFamily:"sans-serif",locale:{"NavigationControl.ZoomIn":"확대","NavigationControl.ZoomOut":"축소","NavigationControl.ResetBearing":"북쪽으로 정렬","GeolocateControl.FindMyLocation":"내 위치","GeolocateControl.LocationNotAvailable":"위치 확인 불가"}});
      mapRef.current=map;
      map.addControl(new lib.AttributionControl({compact:true,customAttribution:'<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> · <a href="/map-data/gamcheon.geojson" target="_blank">지역 데이터</a>'}),"bottom-right");
      map.addControl(new lib.NavigationControl({visualizePitch:true}),"bottom-right");
      map.addControl(new lib.ScaleControl({maxWidth:110,unit:"metric"}),"bottom-left");
      const locate=new lib.GeolocateControl({positionOptions:{enableHighAccuracy:true,timeout:15000,maximumAge:10000},trackUserLocation:false,showAccuracyCircle:true,fitBoundsOptions:{maxZoom:18}});
      map.addControl(locate,"bottom-right");
      geoControl.current=locate;
      locate.on("geolocate",event=>{if(!alive)return;setLocating(false);setGps(`현재 위치 확인 · 오차 반경 약 ${Math.round(event.coords.accuracy).toLocaleString()}m. 감천 밖이라면 ‘마을 전체’로 돌아오세요.`);});
      locate.on("error",event=>{if(!alive)return;setLocating(false);setGps(event.code===1?"위치 권한이 거부되었습니다. 브라우저 설정에서 허용 후 다시 눌러 주세요.":event.code===3?"위치 확인 시간이 초과되었습니다. 야외에서 다시 시도해 주세요.":"현재 위치를 확인할 수 없습니다. 기기의 위치 설정을 확인해 주세요.");});
      map.on("error",event=>{
        if(!alive)return;
        if("sourceId" in event && event.sourceId==="imagery" && !imageryReadyRef.current){setBasemap("street");setImageryUnavailable(true);setStatus("항공사진을 불러오지 못해 일반 지도로 전환했습니다.");return;}
        setStatus(event.error.message.includes("terrain")?"지형 데이터를 불러오지 못했습니다. 평면 지도로 확인해 주세요.":"일부 지도 데이터를 불러오지 못했습니다. 네트워크 상태를 확인해 주세요.");
      });
      map.on("sourcedata",event=>{if(event.sourceId==="imagery" && event.isSourceLoaded)imageryReadyRef.current=true;});
      map.on("load",()=>{
        if(!alive || !map)return;
        map.fitBounds(MAP_BOUNDS,{padding:70,duration:0});
        const labels=map.getStyle().layers.find(layer=>layer.type==="symbol")?.id;
        map.addSource("imagery",{type:"raster",tiles:["https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],tileSize:256,maxzoom:19,attribution:'Imagery © <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noopener">Esri</a>, Vantor, Earthstar Geographics, GIS User Community'});
        map.addLayer({id:"gc-imagery",type:"raster",source:"imagery",paint:{"raster-fade-duration":250}},labels);
        map.addSource("gamcheon",{type:"geojson",data:props.data});
        map.addSource("terrain",{type:"raster-dem",url:"https://tiles.mapterhorn.com/tilejson.json",encoding:"terrarium",tileSize:512,maxzoom:12,attribution:'<a href="https://mapterhorn.com/attribution">© Mapterhorn</a>'});
        const buildingFilter:["==",["get",string],string]=["==",["get","kind"],"building"];
        // A near-transparent hit surface preserves building selection without painting over rooftops.
        map.addLayer({id:"gc-buildings",type:"fill",source:"gamcheon",filter:buildingFilter,paint:{"fill-color":["case",["boolean",["feature-state","selected"],false],"#f1c75c","#ffffff"],"fill-opacity":["case",["boolean",["feature-state","selected"],false],0.28,["boolean",["feature-state","hovered"],false],0.12,0.001]}},labels);
        map.addLayer({id:"gc-building-outlines",type:"line",source:"gamcheon",filter:buildingFilter,paint:{"line-color":["case",["boolean",["feature-state","selected"],false],"#ffe194","#ffffff"],"line-opacity":["case",["boolean",["feature-state","selected"],false],1,["boolean",["feature-state","hovered"],false],0.9,["interpolate",["linear"],["zoom"],15,0,17,0.2,19,0.48]],"line-width":["case",["boolean",["feature-state","selected"],false],2.5,["boolean",["feature-state","hovered"],false],1.5,0.65]}},labels);
        map.addLayer({id:"gc-buildings-3d",type:"fill-extrusion",source:"gamcheon",filter:["all",buildingFilter,["==",["get","heightSource"],"osm"],[">",["get","height"],0]],layout:{visibility:"none"},paint:{"fill-extrusion-color":["case",["boolean",["feature-state","selected"],false],"#17827a","#c8cec6"],"fill-extrusion-height":["get","height"],"fill-extrusion-opacity":0.85}},labels);
        map.addLayer({id:"gc-roads",type:"line",source:"gamcheon",filter:["==",["get","kind"],"road"],layout:{visibility:offlineBasemap?"visible":"none"},paint:{"line-color":"#fcfdfb","line-width":["interpolate",["linear"],["zoom"],14,1,18,4]}},labels);
        map.addLayer({id:"gc-paths",type:"line",source:"gamcheon",filter:["all",["==",["get","kind"],"road"],["match",["get","highway"],["footway","path","pedestrian"],true,false]],paint:{"line-color":"#658b83","line-width":2,"line-dasharray":[2,1.5]}},labels);
        map.addLayer({id:"gc-steps",type:"line",source:"gamcheon",filter:["==",["get","highway"],"steps"],paint:{"line-color":"#c96938","line-width":["interpolate",["linear"],["zoom"],14,2,18,5],"line-dasharray":[.4,1]}},labels);
        map.addLayer({id:"gc-places",type:"circle",source:"gamcheon",filter:["==",["get","kind"],"place"],paint:{"circle-radius":5,"circle-color":"#6a7261","circle-stroke-width":2,"circle-stroke-color":"white"}});
        if(map.getStyle().glyphs) map.addLayer({id:"gc-place-labels",type:"symbol",source:"gamcheon",filter:["all",["==",["get","kind"],"place"],["!=",["get","name"],""]],layout:{"text-field":["get","name"],"text-font":["Noto Sans Regular"],"text-size":12,"text-offset":[0,1.2],"text-anchor":"top","text-max-width":9},paint:{"text-color":"#334b48","text-halo-color":"#ffffff","text-halo-width":2}});
        map.addSource("artist-pins",{type:"geojson",data:artistPoints(latest.current.drafts,props.data.features),cluster:true,clusterRadius:48,clusterMaxZoom:17,clusterProperties:{total:["+",["get","count"]]}});
        map.addLayer({id:"artist-clusters",type:"circle",source:"artist-pins",filter:["has","point_count"],paint:{"circle-radius":22,"circle-color":"#087d74","circle-stroke-width":3,"circle-stroke-color":"white"}});
        map.addLayer({id:"artist-points",type:"circle",source:"artist-pins",filter:["!",["has","point_count"]],paint:{"circle-radius":12,"circle-color":"#087d74","circle-stroke-width":3,"circle-stroke-color":"white"}});
        if(map.getStyle().glyphs){
          map.addLayer({id:"artist-count",type:"symbol",source:"artist-pins",filter:["has","point_count"],layout:{"text-field":["to-string",["get","total"]],"text-font":["Noto Sans Regular"],"text-size":14},paint:{"text-color":"white"}});
          map.addLayer({id:"artist-labels",type:"symbol",source:"artist-pins",filter:["!",["has","point_count"]],layout:{"text-field":["get","label"],"text-font":["Noto Sans Regular"],"text-size":13,"text-offset":[0,1.5],"text-anchor":"top"},paint:{"text-color":"#085850","text-halo-color":"white","text-halo-width":2}});
        }
        map.addSource("entrance",{type:"geojson",data:{type:"FeatureCollection",features:[]}});
        map.addLayer({id:"gc-entrance",type:"circle",source:"entrance",paint:{"circle-radius":8,"circle-color":"#e0763e","circle-stroke-width":3,"circle-stroke-color":"#fff"}});
        map.on("click",async event=>{
          if(!map)return;
          if(latest.current.pickEntrance){latest.current.onEntrance([event.lngLat.lng,event.lngLat.lat]);return;}
          const hit=map.queryRenderedFeatures(event.point,{layers:["artist-clusters","artist-points","gc-places","gc-buildings","gc-buildings-3d"]})[0];
          if(!hit)return;
          if(hit.layer.id==="artist-clusters"){
            const zoom=await (map.getSource("artist-pins") as GeoJSONSource).getClusterExpansionZoom(hit.properties.cluster_id);
            if(alive && hit.geometry.type==="Point")map.easeTo({center:hit.geometry.coordinates as [number,number],zoom});
            return;
          }
          const id=hit.layer.id==="artist-points"?hit.properties.buildingId:hit.id;
          const feature=props.data.features.find(f=>f.id===id);
          if(feature)latest.current.onSelect(feature);
        });
        map.on("mousemove",event=>{
          if(!map)return;
          const hits=map.queryRenderedFeatures(event.point,{layers:["gc-buildings","gc-buildings-3d","gc-places","artist-points","artist-clusters"]});
          map.getCanvas().style.cursor=latest.current.pickEntrance?"crosshair":hits.length?"pointer":"";
          const building=hits.find(hit=>hit.properties.kind==="building");
          if(hoveredRef.current!==building?.id){
            if(hoveredRef.current)map.setFeatureState({source:"gamcheon",id:hoveredRef.current},{hovered:false});
            if(building?.id)map.setFeatureState({source:"gamcheon",id:building.id},{hovered:true});
            hoveredRef.current=building?.id??null;
          }
        });
        setReady(true);setStatus(offlineBasemap?"배경지도 연결 실패 · 저장된 건물과 골목을 표시합니다.":"건물을 누르면 상세 정보와 작가 표시를 연결할 수 있어요.");
      });
    };
    init().catch(()=>{if(alive){setFatal(true);setStatus("이 브라우저에서 지도를 열지 못했습니다. 최신 Chrome 또는 Edge에서 다시 열어 주세요.");}});
    return()=>{alive=false;abort.abort();map?.remove();mapRef.current=null;geoControl.current=null;selectedRef.current=null;hoveredRef.current=null;imageryReadyRef.current=false;};
  },[props.data,retry]);

  useEffect(()=>{
    const map=mapRef.current;if(!ready || !map)return;
    if(selectedRef.current)map.setFeatureState({source:"gamcheon",id:selectedRef.current},{selected:false});
    if(props.selected){map.setFeatureState({source:"gamcheon",id:props.selected.id},{selected:true});map.easeTo({center:centerOf(props.selected),zoom:Math.max(map.getZoom(),18),duration:450});}
    selectedRef.current=props.selected?.id??null;
  },[props.selected,ready]);
  useEffect(()=>{const map=mapRef.current;if(ready && map)(map.getSource("artist-pins") as GeoJSONSource).setData(artistPoints(props.drafts,props.data.features));},[props.drafts,props.data,ready]);
  useEffect(()=>{const map=mapRef.current;if(ready && map)(map.getSource("entrance") as GeoJSONSource).setData({type:"FeatureCollection",features:props.entrance?[{type:"Feature",geometry:{type:"Point",coordinates:props.entrance},properties:{}}]:[]});},[props.entrance,ready]);
  useEffect(()=>{
    const map=mapRef.current;if(!ready || !map)return;
    map.setLayoutProperty("gc-buildings-3d","visibility",mode==="3d"?"visible":"none");
    map.setTerrain(mode==="3d"?{source:"terrain",exaggeration:1}:null);
    map.easeTo({pitch:mode==="3d"?40:0,bearing:0,duration:600});
  },[mode,ready]);
  useEffect(()=>{
    const map=mapRef.current;if(!ready || !map)return;
    const image=basemap==="imagery";
    map.setLayoutProperty("gc-imagery","visibility",image?"visible":"none");
    map.setPaintProperty("gc-buildings","fill-color",["case",["boolean",["feature-state","selected"],false],image?"#f1c75c":"#5c9e90",image?"#ffffff":"#dfdcd3"]);
    map.setPaintProperty("gc-buildings","fill-opacity",["case",["boolean",["feature-state","selected"],false],image?0.28:0.8,["boolean",["feature-state","hovered"],false],image?0.12:0.9,image?0.001:0.75]);
    map.setPaintProperty("gc-building-outlines","line-color",["case",["boolean",["feature-state","selected"],false],image?"#ffe194":"#236d60",image?"#ffffff":"#a5a89f"]);
    map.setPaintProperty("gc-building-outlines","line-opacity",["case",["boolean",["feature-state","selected"],false],1,["boolean",["feature-state","hovered"],false],0.9,["interpolate",["linear"],["zoom"],15,0,17,image?0.2:0.65,19,image?0.48:0.9]]);
  },[basemap,ready]);
  useEffect(()=>{const map=mapRef.current;if(ready && map)for(const layer of ["gc-paths","gc-steps"])map.setLayoutProperty(layer,"visibility",paths?"visible":"none");},[paths,ready]);

  function locate(){
    if(!window.isSecureContext){setGps("현재 위치는 HTTPS 주소 또는 이 컴퓨터의 로컬 미리보기에서 사용할 수 있습니다.");return;}
    if(!navigator.geolocation){setGps("이 브라우저는 위치 확인을 지원하지 않습니다.");return;}
    setLocating(true);setGps("기기에서 위치를 확인하고 있습니다. 위치 권한 요청을 확인해 주세요.");
    if(!geoControl.current?.trigger()){setLocating(false);setGps("위치 확인을 시작하지 못했습니다. 브라우저 위치 권한을 확인해 주세요.");}
  }

  return <section className="gps-map-section" aria-label="실제 감천 지도">
    <div className="gps-map-top"><div className="gps-mode" aria-label="지도 배경"><button disabled={!ready} aria-pressed={basemap==="imagery"} onClick={()=>{setImageryUnavailable(false);setBasemap("imagery");}}>항공사진</button><button disabled={!ready} aria-pressed={basemap==="street"} onClick={()=>setBasemap("street")}>일반 지도</button></div><div className="gps-view-buttons"><button disabled={!ready} className="gps-outline" aria-pressed={mode==="3d"} onClick={()=>setMode(mode==="3d"?"2d":"3d")}>{mode==="3d"?"평면으로":"지형 보기"}</button><button disabled={!ready} className="gps-outline" onClick={()=>mapRef.current?.fitBounds(MAP_BOUNDS,{padding:35,pitch:mode==="3d"?40:0,bearing:0,duration:600})}>마을 전체 ↗</button></div></div>
    <div ref={container} className="gps-canvas" />
    <div className="gps-map-legend"><span><i className="gps-key-building"/>건물</span><span><i className="gps-key-artist"/>작가 초안</span><span><i className="gps-key-step"/>계단</span><button aria-pressed={paths} onClick={()=>setPaths(!paths)} disabled={!ready}>{paths?"골목 표시 켜짐":"골목 표시 꺼짐"}</button></div>
    <div className="gps-map-actions"><button className="gps-location-button" disabled={!ready || locating} onClick={locate}>◎ {locating?"위치 확인 중…":"내 위치"}</button></div>
    {props.pickEntrance && <div className="gps-map-prompt" role="status">출입구가 있는 지점을 지도에서 눌러 주세요.</div>}
    {fatal && <div className="gps-map-failure"><p>{status}</p><button onClick={()=>{setReady(false);setFatal(false);setRetry(n=>n+1);}}>다시 불러오기</button><a href="https://www.openstreetmap.org/#map=17/35.09634/129.00879" target="_blank" rel="noopener noreferrer">외부 지도에서 보기 ↗</a></div>}
    <div className="gps-map-status" aria-live="polite"><p>{status}</p><p>{gps}</p>{imageryUnavailable && <p>항공사진 연결 실패 · 일반 지도를 이용할 수 있습니다.</p>}{basemap==="imagery" && <p>항공사진과 건물 윤곽의 제작 시점·촬영 각도가 달라 경계가 어긋날 수 있습니다.</p>}{mode==="3d" && <p>약 30m급 지형 표현입니다. 높이가 없는 건물은 윤곽만 표시하며 실제 건물 외형을 재현한 3D 모델은 아닙니다.</p>}</div>
  </section>;
}

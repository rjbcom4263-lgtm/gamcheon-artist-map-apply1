import type { MapData, MapFeature } from "./geo";

// Retained for provenance and regression checks of the user's first selected area.
export const FIRST_AREA = { west:129.00853, south:35.09274, east:129.01053, north:35.09745 };
// Culture-village overview and connecting alleys, within the available OSM snapshot.
// Working envelope, not an official administrative or special-management boundary.
export const AREA = { west:129.006, south:35.09274, east:129.0135, north:35.0992 };
export const ORIGIN: [number,number] = [(AREA.west+AREA.east)/2,(AREA.south+AREA.north)/2];
const metersLat = 111195;
const metersLng = metersLat * Math.cos(ORIGIN[1]*Math.PI/180);
export const WIDTH=(AREA.east-AREA.west)*metersLng;
export const DEPTH=(AREA.north-AREA.south)*metersLat;
export function toLocal(p: number[]): [number,number] { return [(p[0]-ORIGIN[0])*metersLng, -(p[1]-ORIGIN[1])*metersLat]; }
export function toGps(x:number,z:number): [number,number] { return [ORIGIN[0]+x/metersLng,ORIGIN[1]-z/metersLat]; }
export function inArea(p:number[]) { return p[0]>=AREA.west && p[0]<=AREA.east && p[1]>=AREA.south && p[1]<=AREA.north; }

// Liang–Barsky clipping preserves only existing road segments; no invented links.
export function clipSegment(a:number[],b:number[]): number[][]|null {
  let low=0,high=1;
  const dx=b[0]-a[0],dy=b[1]-a[1];
  const ps=[-dx,dx,-dy,dy],qs=[a[0]-AREA.west,AREA.east-a[0],a[1]-AREA.south,AREA.north-a[1]];
  for(let i=0;i<4;i++) {
    if(ps[i]===0) { if(qs[i]<0)return null; continue; }
    const t=qs[i]/ps[i];
    if(ps[i]<0)low=Math.max(low,t);else high=Math.min(high,t);
    if(low>high)return null;
  }
  return [[a[0]+dx*low,a[1]+dy*low],[a[0]+dx*high,a[1]+dy*high]];
}
export function scopeData(data:MapData): MapData {
  const features:MapFeature[]=[];
  for(const f of data.features) {
    if(f.geometry.type==="Point") { if(inArea(f.geometry.coordinates))features.push(f); }
    else if(f.geometry.type==="Polygon") {
      const ring=f.geometry.coordinates[0];
      if(ring.some(inArea) || ring.some((p,i)=>i>0&&clipSegment(ring[i-1],p)))features.push(f);
    } else if(f.geometry.type==="LineString") {
      let run:number[][]=[];let part=0;
      const emit=()=>{if(run.length>1)features.push({...f,id:`${f.id}/part-${part++}`,geometry:{type:"LineString",coordinates:run}});run=[];};
      for(let i=1;i<f.geometry.coordinates.length;i++) {
        const segment=clipSegment(f.geometry.coordinates[i-1],f.geometry.coordinates[i]);
        if(!segment){emit();continue;}
        if(run.length && (Math.abs(run.at(-1)![0]-segment[0][0])>1e-10 || Math.abs(run.at(-1)![1]-segment[0][1])>1e-10))emit();
        if(!run.length)run.push(segment[0]);run.push(segment[1]);
      }
      emit();
    }
  }
  return {...data,metadata:{...data.metadata,scope:"감천문화마을 주요 관광 구역과 연결 골목 · 기존 1차 구역 포함 · 공식 경계가 아닌 작업 범위"},features};
}
export type BuildingAppearance={height:number;wall:string;roof:string;windows:boolean};
export const MAX_BUILDING_HEIGHT=120;
export function validAppearance(value:unknown):value is BuildingAppearance {
  if(!value || typeof value!=="object")return false;
  const v=value as BuildingAppearance;
  return Number.isFinite(v.height)&&v.height>=2&&v.height<=MAX_BUILDING_HEIGHT&&/^#[0-9a-f]{6}$/i.test(v.wall)&&/^#[0-9a-f]{6}$/i.test(v.roof)&&typeof v.windows==="boolean";
}
export function appearanceFor(f:MapFeature):BuildingAppearance {
  // A uniform 6m preview is explicitly unverified and never written into OSM facts.
  return {height:f.properties.height??(f.properties.levels?f.properties.levels*3:6),wall:"#e9e5d7",roof:"#7babad",windows:false};
}
export const LANDMARKS = [
  {name:"어린왕자상",coordinate:[129.0085955,35.09778],source:"https://www.openstreetmap.org/node/10679830337"},
  {name:"방가방가 게스트하우스 부근",coordinate:[129.009552,35.097181],source:"https://triple.guide/hotels/6f1917be-c7e9-498b-86f3-4bf05fbabc59"},
  {name:"감천제일교회 부근",coordinate:[129.00915516545504,35.09397150178058],source:"https://cmap.or.kr/page.php?cno=31"},
  {name:"공영주차장 부근 · 위치 대조 필요",coordinate:[129.00946,35.09338],source:"사용자 제공 캡처에서 추정"},
];

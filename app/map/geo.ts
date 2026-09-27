import type { Feature, FeatureCollection, Geometry, Position } from "geojson";

export const VILLAGE_CENTER: [number, number] = [129.0087897, 35.0963371];
export const MAP_BOUNDS: [[number, number], [number, number]] = [[129.004,35.092],[129.015,35.101]];
export type MapProperties = { osmId:string;kind:string;name:string;address:string;building:string;highway:string;tourism:string;access:string;foot:string;incline:string;surface:string;height:number|null;heightSource:string;levels:number|null };
export type MapFeature = Feature<Geometry,MapProperties>;
export type MapData = FeatureCollection<Geometry,MapProperties> & { metadata:{ fetchedAt:string;osmTimestamp:string;scope:string } };
export type ArtistDraft = { id:string;buildingId:string;name:string;field:string;studio:string;floor:string;entrance:[number,number]|null;note:string;status:"draft" };

export function centerOf(feature: MapFeature): [number,number] {
  if (feature.geometry.type === "Point") return feature.geometry.coordinates as [number,number];
  const points = feature.geometry.type === "Polygon" ? feature.geometry.coordinates[0] : feature.geometry.type === "LineString" ? feature.geometry.coordinates : [];
  if (!points.length) return VILLAGE_CENTER;
  return [(Math.min(...points.map(p=>p[0]))+Math.max(...points.map(p=>p[0])))/2,(Math.min(...points.map(p=>p[1]))+Math.max(...points.map(p=>p[1])))/2];
}

export function distanceMeters(a: Position,b: Position) {
  const rad = Math.PI/180;
  const h = Math.sin((b[1]-a[1])*rad/2)**2 + Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin((b[0]-a[0])*rad/2)**2;
  return 6371000*2*Math.asin(Math.min(1,Math.sqrt(h)));
}

export function draftError(draft: ArtistDraft, building: MapFeature | undefined) {
  if (!building || building.properties.kind!=="building" || draft.buildingId!==building.id) return "연결할 건물을 다시 선택해 주세요.";
  if (!draft.name.trim() || draft.name.length>50) return "작가 이름을 1~50자로 입력해 주세요.";
  if (!draft.studio.trim() || draft.studio.length>80) return "작업실 이름을 1~80자로 입력해 주세요.";
  if (!draft.field.trim() || draft.field.length>30 || draft.floor.length>30 || draft.note.length>300) return "입력 길이를 확인해 주세요.";
  if (draft.entrance && (!draft.entrance.every(Number.isFinite) || Math.abs(draft.entrance[0])>180 || Math.abs(draft.entrance[1])>90 || distanceMeters(centerOf(building),draft.entrance)>150)) return "출입구는 선택한 건물 주변 150m 안에서 지정해 주세요.";
  return "";
}

export function artistPoints(drafts:ArtistDraft[],buildings:MapFeature[]): FeatureCollection {
  const grouped = new Map<string,ArtistDraft[]>();
  for (const d of drafts) grouped.set(d.buildingId,[...(grouped.get(d.buildingId)??[]),d]);
  return {type:"FeatureCollection",features:[...grouped].flatMap(([id,items])=>{
    const building=buildings.find(b=>b.id===id);
    return building ? [{type:"Feature" as const,geometry:{type:"Point" as const,coordinates:centerOf(building)},properties:{buildingId:id,count:items.length,label:items.length>1?`${items.length}명 · 초안`:`${items[0].name} · 초안`}}] : [];
  })};
}

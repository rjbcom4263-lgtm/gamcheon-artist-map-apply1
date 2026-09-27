// Converts the bounded OSM snapshot; no invented footprints or connections.
import { readFile, writeFile } from "node:fs/promises";
const input = JSON.parse(await readFile(new URL("../public/map-data/osm-source.json", import.meta.url), "utf8"));
if (input.remark || !Array.isArray(input.elements)) throw Error("Incomplete OSM response");
if (input.elements.some(e => e.type === "relation" && e.tags?.building)) throw Error("Building multipolygons need a topology-aware converter; do not silently omit them.");
const features = [];
for (const element of input.elements) {
  const t = element.tags ?? {};
  let geometry, kind;
  if (element.type === "way" && element.geometry?.length >= 2) {
    const coordinates = element.geometry.map(p => [p.lon, p.lat]);
    if (t.building) {
      if (coordinates.length < 4 || JSON.stringify(coordinates[0]) !== JSON.stringify(coordinates.at(-1))) throw Error(`Open building outline ${element.id}`);
      geometry = { type: "Polygon", coordinates: [coordinates] };
      kind = "building";
    } else if (t.highway) {
      geometry = { type: "LineString", coordinates };
      kind = "road";
    }
  } else if (element.type === "node" && (t.tourism || t.entrance)) {
    geometry = { type: "Point", coordinates: [element.lon, element.lat] };
    kind = t.entrance ? "entrance" : "place";
  }
  if (!geometry) continue;
  const height = Number(t.height?.replace(/\s*m$/, ""));
  const levels = Number(t["building:levels"]);
  features.push({type:"Feature",id:`${element.type}/${element.id}`,geometry,properties:{
    osmId:`${element.type}/${element.id}`,kind,name:t["name:ko"] || t.name || "",
    address:[t["addr:street"],t["addr:housenumber"]].filter(Boolean).join(" "),
    building:t.building || "",highway:t.highway || "",tourism:t.tourism || "",
    access:t.access || "unknown",foot:t.foot || "unknown",incline:t.incline || "unknown",surface:t.surface || "unknown",
    // Floor counts do not determine metric height. Missing heights stay unknown.
    height:Number.isFinite(height) && height>0 ? height : null,
    heightSource:Number.isFinite(height) && height>0 ? "osm" : Number.isFinite(levels) && levels>0 ? "levels" : "unknown",
    levels:Number.isFinite(levels) && levels>0 ? levels : null,
  }});
}
const output = {type:"FeatureCollection",metadata:{
  fetchedAt:new Date().toISOString(),osmTimestamp:input.osm3s?.timestamp_osm_base,
  source:"https://overpass.private.coffee/api/interpreter",license:"ODbL-1.0",attribution:"© OpenStreetMap contributors",
  bbox:[129.004,35.092,129.015,35.101],
  scope:"감천문화마을과 주변 조회 범위. 감천2동 행정경계가 아닙니다.",
},features};
await writeFile(new URL("../public/map-data/gamcheon.geojson",import.meta.url),JSON.stringify(output));
console.log(JSON.stringify({buildings:features.filter(f=>f.properties.kind==="building").length,roads:features.filter(f=>f.properties.kind==="road").length,steps:features.filter(f=>f.properties.highway==="steps").length,places:features.filter(f=>f.properties.kind==="place").length,registeredHeights:features.filter(f=>f.properties.kind==="building" && f.properties.heightSource==="osm").length}));

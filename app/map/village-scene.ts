import * as THREE from "three";
import type { MapFeature } from "./geo";
import { AREA, DEPTH, WIDTH, toGps, toLocal } from "./village";
import type { BuildingAppearance } from "./village";

export type Elevation=(x:number,z:number)=>number;
export function overviewFrame(bounds:THREE.Box3,aspect:number,fov:number,top=false) {
  const target=bounds.getCenter(new THREE.Vector3());
  const direction=new THREE.Vector3(top?0:.51,top?1:.94,top?.0001:.86).normalize();
  const camera=new THREE.PerspectiveCamera(fov,aspect);camera.position.copy(target).add(direction);camera.lookAt(target);
  const inverse=camera.quaternion.clone().invert(),tanY=Math.tan(fov*Math.PI/360),tanX=tanY*aspect;
  let distance=1;
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]) {
    const p=new THREE.Vector3(x,y,z).sub(target).applyQuaternion(inverse);
    distance=Math.max(distance,Math.abs(p.x)/tanX+p.z,Math.abs(p.y)/tanY+p.z);
  }
  distance*=1.18;
  return {target,position:target.clone().addScaledVector(direction,distance),distance};
}
export function buildingModel(feature:MapFeature,appearance:BuildingAppearance,elevation:Elevation) {
  const group=new THREE.Group(); group.name=String(feature.id);group.userData.feature=feature;
  if(feature.geometry.type!=="Polygon")return group;
  const ring=feature.geometry.coordinates[0].slice(0,-1).map(toLocal);
  const x=ring.reduce((s,p)=>s+p[0],0)/ring.length,z=ring.reduce((s,p)=>s+p[1],0)/ring.length;
  const ground=ring.map(p=>elevation(...p)),base=Math.min(...ground),topGround=Math.max(...ground);
  group.position.set(x,base,z);
  const shape=new THREE.Shape(ring.map(p=>new THREE.Vector2(p[0]-x,-(p[1]-z))));
  for(const hole of feature.geometry.coordinates.slice(1))shape.holes.push(new THREE.Path(hole.slice(0,-1).map(p=>{const [hx,hz]=toLocal(p);return new THREE.Vector2(hx-x,-(hz-z));})));
  const height=appearance.height;
  function volume(depth:number,y:number,color:string) {
    const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1,curveSegments:1});
    geometry.rotateX(-Math.PI/2);
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:1}));
    mesh.position.y=y;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.buildingId=feature.id;group.add(mesh);return mesh;
  }
  const foundation=Math.max(0,topGround-base);
  if(foundation>0.1)volume(foundation,0,"#b5b5a6");
  const wall=volume(height,foundation,appearance.wall);wall.name="wall";
  const roof=volume(.22,foundation+height,appearance.roof);roof.name="roof";
  // Roof rim follows the actual footprint. Flat roof and facade details are provisional.
  const edges=new THREE.LineSegments(new THREE.EdgesGeometry(roof.geometry),new THREE.LineBasicMaterial({color:"#526862",transparent:true,opacity:.4}));edges.name="roof-outline";
  edges.position.y=roof.position.y;group.add(edges);
  if(appearance.windows) {
    const mat=new THREE.MeshStandardMaterial({color:"#506d78",roughness:.8});
    const geometry=new THREE.BoxGeometry(.85,1,.055);
    for(let i=0;i<ring.length;i++) {
      const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
      if(length<2.8)continue;
      const count=Math.min(10,Math.floor(length/2.8)),floors=Math.min(8,Math.floor(height/3));
      for(let floor=0;floor<floors;floor++)for(let n=0;n<count;n++) {
        const t=(n+1)/(count+1),windowMesh=new THREE.Mesh(geometry,mat);
        windowMesh.position.set(a[0]+dx*t-x,foundation+1.6+floor*3,a[1]+dz*t-z);
        windowMesh.rotation.y=-Math.atan2(dz,dx);group.add(windowMesh);
      }
    }
  }
  group.userData.roofY=base+foundation+height+.22;
  return group;
}

export function terrainModel(elevation:Elevation) {
  const geometry=new THREE.PlaneGeometry(WIDTH,DEPTH,Math.ceil(WIDTH/10),Math.ceil(DEPTH/10));geometry.rotateX(-Math.PI/2);
  const positions=geometry.attributes.position;
  const colors:number[]=[];
  for(let i=0;i<positions.count;i++) {
    const x=positions.getX(i),z=positions.getZ(i),y=elevation(x,z);positions.setY(i,y);
    const shade=THREE.MathUtils.clamp(.88+y/450,.86,1.06);
    const color=new THREE.Color("#c6d1b5").multiplyScalar(shade);colors.push(color.r,color.g,color.b);
  }
  geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
  const terrain=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}));terrain.receiveShadow=true;terrain.name="ground";
  const skirtVertices:number[]=[];
  const corners=[[-WIDTH/2,-DEPTH/2],[WIDTH/2,-DEPTH/2],[WIDTH/2,DEPTH/2],[-WIDTH/2,DEPTH/2],[-WIDTH/2,-DEPTH/2]];
  for(let side=1;side<corners.length;side++)for(let n=0;n<48;n++) {
    const a=corners[side-1],b=corners[side];
    const p=[a[0]+(b[0]-a[0])*n/48,a[1]+(b[1]-a[1])*n/48],q=[a[0]+(b[0]-a[0])*(n+1)/48,a[1]+(b[1]-a[1])*(n+1)/48];
    const v=[[p[0],elevation(p[0],p[1]),p[1]],[q[0],elevation(q[0],q[1]),q[1]],[p[0],-1,p[1]],[q[0],-1,q[1]]];
    for(const k of [0,1,2,2,1,3])skirtVertices.push(...v[k]);
  }
  const skirt=new THREE.BufferGeometry();skirt.setAttribute("position",new THREE.Float32BufferAttribute(skirtVertices,3));skirt.computeVertexNormals();
  terrain.add(new THREE.Mesh(skirt,new THREE.MeshStandardMaterial({color:"#a7b69f",roughness:1,side:THREE.DoubleSide})));
  return terrain;
}

export function roadModel(features:MapFeature[],elevation:Elevation) {
  const group=new THREE.Group();
  for(const f of features) {
    if(f.geometry.type!=="LineString")continue;
    const steps=f.properties.highway==="steps",foot=["steps","footway","path","pedestrian"].includes(f.properties.highway);
    const width=steps?1.6:foot?1.3:["tertiary","secondary"].includes(f.properties.highway)?6:3.8;
    const points=f.geometry.coordinates.map(toLocal);const vertices:number[]=[];
    for(let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.01)continue;
      const nx=-(b[1]-a[1])/length*width/2,nz=(b[0]-a[0])/length*width/2;
      const segments=Math.max(1,Math.ceil(length/3));
      for(let j=0;j<segments;j++) {
        if(steps&&j%2===1)continue;
        const p=[a[0]+(b[0]-a[0])*j/segments,a[1]+(b[1]-a[1])*j/segments];
        const q=[a[0]+(b[0]-a[0])*(j+1)/segments,a[1]+(b[1]-a[1])*(j+1)/segments];
        const quad=[[p[0]+nx,p[1]+nz],[p[0]-nx,p[1]-nz],[q[0]+nx,q[1]+nz],[q[0]-nx,q[1]-nz]];
        for(const k of [0,1,2,2,1,3])vertices.push(quad[k][0],elevation(...quad[k] as [number,number])+.18,quad[k][1]);
      }
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:steps?"#c78044":foot?"#fbefcc":"#f1f0e6",side:THREE.DoubleSide,roughness:1}));mesh.receiveShadow=true;group.add(mesh);
  }
  return group;
}

function tilePixel(lng:number,lat:number,zoom:number) {
  const n=2**zoom,s=Math.sin(lat*Math.PI/180);
  return [(lng+180)/360*n,(.5-Math.log((1+s)/(1-s))/(4*Math.PI))*n];
}
async function readTile(url:string,signal:AbortSignal) {
  const response=await fetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(12000)])});if(!response.ok)throw Error("tile unavailable");
  const bitmap=await createImageBitmap(await response.blob());
  const canvas=document.createElement("canvas");canvas.width=bitmap.width;canvas.height=bitmap.height;
  const context=canvas.getContext("2d",{willReadFrequently:true});if(!context){bitmap.close();throw Error("canvas unavailable");}
  context.drawImage(bitmap,0,0);bitmap.close();return context.getImageData(0,0,canvas.width,canvas.height);
}
export async function loadElevation(signal:AbortSignal):Promise<Elevation> {
  const zoom=12,tiles=new Map<string,ImageData>();
  const nw=tilePixel(AREA.west,AREA.north,zoom),se=tilePixel(AREA.east,AREA.south,zoom);
  await Promise.all(Array.from({length:Math.floor(se[0])-Math.floor(nw[0])+1},(_,i)=>Math.floor(nw[0])+i).flatMap(x=>Array.from({length:Math.floor(se[1])-Math.floor(nw[1])+1},(_,i)=>Math.floor(nw[1])+i).map(async y=>{tiles.set(`${x}/${y}`,await readTile(`https://tiles.mapterhorn.com/${zoom}/${x}/${y}.webp`,signal));})));
  function sample(x:number,z:number) {
    const p=tilePixel(...toGps(x,z),zoom),ix=Math.floor(p[0]),iy=Math.floor(p[1]),tile=tiles.get(`${ix}/${iy}`);
    if(!tile)throw Error("terrain outside loaded area");
    const px=THREE.MathUtils.clamp((p[0]-ix)*tile.width,0,tile.width-1),py=THREE.MathUtils.clamp((p[1]-iy)*tile.height,0,tile.height-1);
    const height=(xx:number,yy:number)=>{const i=(Math.min(tile.height-1,yy)*tile.width+Math.min(tile.width-1,xx))*4;return tile.data[i]*256+tile.data[i+1]+tile.data[i+2]/256-32768;};
    const ax=Math.floor(px),ay=Math.floor(py),fx=px-ax,fy=py-ay;
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(height(ax,ay),height(ax+1,ay),fx),THREE.MathUtils.lerp(height(ax,ay+1),height(ax+1,ay+1),fx),fy);
  }
  const heights:number[]=[];for(let x=0;x<=16;x++)for(let z=0;z<=32;z++)heights.push(sample(-WIDTH/2+WIDTH*x/16,-DEPTH/2+DEPTH*z/32));
  const baseline=Math.min(...heights);
  return (x,z)=>sample(THREE.MathUtils.clamp(x,-WIDTH/2,WIDTH/2),THREE.MathUtils.clamp(z,-DEPTH/2,DEPTH/2))-baseline;
}

export async function loadRoofColors(features:MapFeature[],signal:AbortSignal) {
  const zoom=18,cache=new Map<string,Promise<ImageData>>();const result=new Map<string,string>();
  // Only a small rooftop-center patch is sampled. These are aerial estimates, not facade observations.
  await Promise.all(features.map(async f=>{
    if(f.geometry.type!=="Polygon")return;
    const ring=f.geometry.coordinates[0].slice(0,-1),lng=ring.reduce((s,p)=>s+p[0],0)/ring.length,lat=ring.reduce((s,p)=>s+p[1],0)/ring.length;
    const [tx,ty]=tilePixel(lng,lat,zoom),ix=Math.floor(tx),iy=Math.floor(ty),key=`${ix}/${iy}`;
    if(!cache.has(key))cache.set(key,readTile(`https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${iy}/${ix}`,signal));
    try {
      const tile=await cache.get(key)!;const channels:[number[],number[],number[]]=[[],[],[]];
      const px=Math.floor((tx-ix)*tile.width),py=Math.floor((ty-iy)*tile.height);
      for(let y=-2;y<=2;y++)for(let x=-2;x<=2;x++){const index=(THREE.MathUtils.clamp(py+y,0,tile.height-1)*tile.width+THREE.MathUtils.clamp(px+x,0,tile.width-1))*4;channels.forEach((c,k)=>c.push(tile.data[index+k]));}
      const median=channels.map(c=>c.sort((a,b)=>a-b)[12]/255);
      const color=new THREE.Color().setRGB(median[0],median[1],median[2],THREE.SRGBColorSpace);
      const hsl={h:0,s:0,l:0};color.getHSL(hsl);color.setHSL(hsl.h,Math.min(.55,hsl.s),Math.min(.65,Math.max(.26,hsl.l+.12)));
      result.set(String(f.id),`#${color.getHexString()}`);
    } catch { /* Keep the explicitly provisional neutral roof if an imagery tile fails. */ }
  }));
  return result;
}

export function disposeObject(object:THREE.Object3D) {
  object.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m.dispose());}});
}

import { readMapAlleys } from "../../map/map-alleys-db";

export const runtime = "edge";

// 공개 지도가 쓰는 골목길 목록입니다(관리자가 확인한 길만, GPS 기록·버린 후보는 내보내지 않음).
export async function GET() {
  try {
    const { alleys, updatedAt } = await readMapAlleys();
    return Response.json({ alleys, updatedAt }, { headers: { "cache-control": "public, max-age=60" } });
  } catch (error) {
    console.error("map alleys read failed", error);
    return Response.json({ alleys: [] }, { headers: { "cache-control": "no-store" } });
  }
}

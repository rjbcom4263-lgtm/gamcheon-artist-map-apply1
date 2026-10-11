import { readPublishedBuildingEdits } from "../../map/map-buildings-db";

export const runtime = "edge";

// 공개 지도가 쓰는 건물 고친 내용(공개본만, 초안은 내보내지 않음).
export async function GET() {
  try {
    const { edits, publishedAt } = await readPublishedBuildingEdits();
    return Response.json({ edits, publishedAt }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("map building edits read failed", error);
    return Response.json({ error: "공개 건물 데이터를 불러오지 못했습니다." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

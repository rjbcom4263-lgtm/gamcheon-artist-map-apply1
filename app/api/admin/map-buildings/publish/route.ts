import { requireAdmin } from "../../../../admin/admin-auth";
import { readBuildingEdits, writeBuildingEdits } from "../../../../map/map-buildings-db";

export const runtime = "edge";

// 초안을 공개본으로 옮겨 공개 지도에 반영합니다.
export async function POST() {
  if (!await requireAdmin()) return new Response("Forbidden", { status: 403 });
  try {
    const { draft } = await readBuildingEdits();
    await writeBuildingEdits("published", draft);
    return Response.json({ published: draft });
  } catch (error) {
    console.error("map building publish failed", error);
    return Response.json({ error: "공개하지 못했습니다." }, { status: 500 });
  }
}

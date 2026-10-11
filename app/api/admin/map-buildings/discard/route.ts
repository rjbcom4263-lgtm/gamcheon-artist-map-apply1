import { requireAdmin } from "../../../../admin/admin-auth";
import { readBuildingEdits, writeBuildingEdits } from "../../../../map/map-buildings-db";

export const runtime = "edge";

// 초안을 버리고 공개본 상태로 되돌립니다.
export async function POST() {
  if (!await requireAdmin()) return new Response("Forbidden", { status: 403 });
  try {
    const { published } = await readBuildingEdits();
    await writeBuildingEdits("draft", published);
    return Response.json({ draft: published });
  } catch (error) {
    console.error("map building discard failed", error);
    return Response.json({ error: "초안을 되돌리지 못했습니다." }, { status: 500 });
  }
}

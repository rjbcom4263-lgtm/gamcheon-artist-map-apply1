import { requireAdmin } from "../../../admin/admin-auth";
import { cleanBuildingEdits, readBuildingEdits, writeBuildingEdits } from "../../../map/map-buildings-db";

export const runtime = "edge";

// 작업실 '건물' 탭: 초안과 공개본을 읽고, 초안을 저장합니다(공개 지도에는 '공개하기' 전까지 나가지 않음).
export async function GET() {
  if (!await requireAdmin()) return new Response("Forbidden", { status: 403 });
  return Response.json(await readBuildingEdits(), { headers: { "cache-control": "no-store" } });
}

export async function PUT(request: Request) {
  if (!await requireAdmin()) return new Response("Forbidden", { status: 403 });
  try {
    const body = await request.json() as { draft?: unknown };
    const draft = cleanBuildingEdits(body.draft);
    if (!draft) return Response.json({ error: "건물 고친 내용의 형식이 맞지 않습니다." }, { status: 400 });
    await writeBuildingEdits("draft", draft);
    return Response.json({ draft });
  } catch (error) {
    console.error("map building draft save failed", error);
    return Response.json({ error: "초안을 저장하지 못했습니다." }, { status: 500 });
  }
}

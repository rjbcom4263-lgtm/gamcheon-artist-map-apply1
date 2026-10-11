import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../admin/admin-auth";
import { isModelId, modelKey, modelUse } from "../../../../map/map-models";

export const runtime = "edge";

// 올린 3D 모델 파일 지우기(관리자만). 초안이나 공개 지도에 둔 모델은 먼저 지도에서 지워야 합니다.
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return new Response("Forbidden", { status: 403 });
  const { id } = await context.params;
  if (!isModelId(id)) return Response.json({ error: "모델 번호가 맞지 않습니다." }, { status: 400 });
  try {
    const use = await modelUse(id);
    if (use.draft || use.published) {
      return Response.json({ error: use.published ? "공개 지도에 둔 모델입니다. 지도에서 지우고 공개한 뒤 지워 주세요." : "초안에 둔 모델입니다. 지도에서 먼저 지워 주세요." }, { status: 409 });
    }
    await env.BUCKET.delete(modelKey(id));
    return Response.json({ ok: true });
  } catch (error) {
    console.error("map model delete failed", error);
    return Response.json({ error: "모델 파일을 지우지 못했습니다." }, { status: 500 });
  }
}

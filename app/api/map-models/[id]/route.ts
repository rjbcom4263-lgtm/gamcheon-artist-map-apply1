import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../admin/admin-auth";
import { isModelId, isPublishedModel, modelKey } from "../../../map/map-models";

export const runtime = "edge";

// 3D 모델(GLB) 파일. 공개 지도에 둔 모델은 누구나 받고, 아직 공개하지 않은 모델은 관리자만 받습니다.
// 같은 번호의 파일은 바뀌지 않으므로(새로 올리면 새 번호) 공개 모델은 오래 캐시합니다.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isModelId(id)) return new Response("Not found", { status: 404 });
  try {
    const published = await isPublishedModel(id);
    if (!published && !await requireAdmin()) return new Response("Not found", { status: 404 });
    const object = await env.BUCKET.get(modelKey(id));
    if (!object) return new Response("Not found", { status: 404 });
    return new Response(object.body, {
      headers: {
        "content-type": "model/gltf-binary",
        "cache-control": published ? "public, max-age=86400" : "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    console.error("map model read failed", error);
    return new Response("Error", { status: 500 });
  }
}

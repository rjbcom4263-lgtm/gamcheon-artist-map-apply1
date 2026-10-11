import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../admin/admin-auth";
import { checkGlb, listModelFiles, MAX_GLB_BYTES, modelKey, newModelId } from "../../../map/map-models";

export const runtime = "edge";

// 작업실 '건물' 탭: 올린 3D 모델(GLB) 파일 목록과 새 파일 올리기(관리자만)
export async function GET() {
  if (!await requireAdmin()) return new Response("Forbidden", { status: 403 });
  try {
    return Response.json({ files: await listModelFiles() }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("map model list failed", error);
    return Response.json({ error: "모델 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!await requireAdmin()) return new Response("Forbidden", { status: 403 });
  try {
    const length = Number(request.headers.get("content-length") || 0);
    if (length > MAX_GLB_BYTES + 64 * 1024) return Response.json({ error: "파일이 너무 큽니다(최대 20MB)." }, { status: 413 });
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string" || !file.size) return Response.json({ error: "GLB 파일을 골라 주세요." }, { status: 400 });
    if (file.size > MAX_GLB_BYTES) return Response.json({ error: "파일이 너무 큽니다(최대 20MB)." }, { status: 413 });
    const buffer = await file.arrayBuffer();
    const problem = checkGlb(buffer);
    if (problem) return Response.json({ error: problem }, { status: 400 });
    const id = newModelId();
    const name = file.name.replace(/\.glb$/i, "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 80) || "모델";
    await env.BUCKET.put(modelKey(id), buffer, { httpMetadata: { contentType: "model/gltf-binary" }, customMetadata: { name } });
    return Response.json({ file: { id, name, size: buffer.byteLength } });
  } catch (error) {
    console.error("map model upload failed", error);
    return Response.json({ error: "모델을 올리지 못했습니다." }, { status: 500 });
  }
}

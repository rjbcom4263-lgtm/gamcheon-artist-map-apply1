import { env } from "cloudflare:workers";
import { MODEL_FILE_ID, readBuildingEdits, readPublishedBuildingEdits } from "./map-buildings-db";

// 골목지도 작업실 '건물' 탭에서 관리자가 올린 3D 모델(GLB) 파일을 R2(BUCKET)의 map-models/ 아래에 둡니다.
// 검사 규칙은 골목지도의 src/glbCheck.ts와 같습니다(작업실에서 먼저 검사하고, 여기서 다시 검사).
export const MAX_GLB_BYTES = 20 * 1024 * 1024;
const UNSUPPORTED_EXTENSIONS = ["KHR_draco_mesh_compression", "EXT_meshopt_compression", "KHR_texture_basisu"];
const PREFIX = "map-models/";

export const isModelId = (value: unknown): value is string => typeof value === "string" && MODEL_FILE_ID.test(value);
export const modelKey = (id: string) => `${PREFIX}${id}.glb`;
export const newModelId = () => `m-${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;

export function checkGlb(buffer: ArrayBuffer): string | null {
  if (buffer.byteLength > MAX_GLB_BYTES) return "파일이 너무 큽니다(최대 20MB).";
  if (buffer.byteLength < 20) return "GLB 파일이 아닙니다.";
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67) return "GLB 파일이 아닙니다.";
  if (view.getUint32(4, true) !== 2) return "glTF 2.0 형식의 GLB만 올릴 수 있습니다.";
  if (view.getUint32(8, true) !== buffer.byteLength) return "GLB 파일이 손상되었습니다.";
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || 20 + jsonLength > buffer.byteLength) return "GLB 파일이 손상되었습니다.";
  let json: { buffers?: { uri?: unknown }[]; images?: { uri?: unknown }[]; extensionsRequired?: unknown; meshes?: unknown[] };
  try {
    json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)));
  } catch {
    return "GLB 파일이 손상되었습니다.";
  }
  if ([...(json.buffers ?? []), ...(json.images ?? [])].some((item) => typeof item?.uri === "string" && !item.uri.startsWith("data:"))) {
    return "다른 파일을 불러오는 GLB는 올릴 수 없습니다.";
  }
  const required = Array.isArray(json.extensionsRequired) ? json.extensionsRequired : [];
  if (required.some((name) => UNSUPPORTED_EXTENSIONS.includes(String(name)))) return "압축을 끄고 다시 내보내 주세요.";
  if (!Array.isArray(json.meshes) || !json.meshes.length) return "모델 안에 도형이 없습니다.";
  return null;
}

export async function listModelFiles() {
  const files: { id: string; name: string; size: number; uploaded: string }[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.BUCKET.list({ prefix: PREFIX, cursor, include: ["customMetadata"] });
    for (const object of page.objects) {
      const id = object.key.slice(PREFIX.length).replace(/\.glb$/, "");
      if (!isModelId(id)) continue;
      files.push({ id, name: object.customMetadata?.name || id, size: object.size, uploaded: object.uploaded.toISOString() });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return files.sort((a, b) => a.uploaded.localeCompare(b.uploaded));
}

// 공개 지도에 둔 모델 파일인지(공개 파일 요청마다 부르므로 공개본만 읽습니다)
export async function isPublishedModel(id: string) {
  const { edits } = await readPublishedBuildingEdits();
  return edits.models.some((model) => model.modelId === id);
}

// 초안이나 공개본에 쓰인 모델 파일인지
export async function modelUse(id: string) {
  const { draft, published } = await readBuildingEdits();
  return { draft: draft.models.some((model) => model.modelId === id), published: published.models.some((model) => model.modelId === id) };
}

// 브라우저에서 업로드 전에 이미지를 줄입니다(신청 폼에서 사용). 서버 제한(2MB)보다 넉넉히 아래로 맞춥니다.

const SKIP_BELOW_BYTES = 900 * 1024;
const TARGET_BYTES = 1100 * 1024;
const MAX_EDGE = 1600;
const QUALITIES = [0.82, 0.7, 0.58];

export async function compressImage(file: File) {
  if (file.size <= SKIP_BELOW_BYTES) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let blob: Blob | null = null;
  for (const quality of QUALITIES) {
    blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= TARGET_BYTES) break;
  }
  if (!blob) throw new Error("이미지를 변환하지 못했습니다.");
  const name = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${name}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

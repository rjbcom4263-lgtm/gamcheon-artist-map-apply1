const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isAllowedImageType(contentType: string) {
  return ALLOWED_IMAGE_TYPES.has(contentType.toLowerCase());
}

export function isAllowedImageBytes(contentType: string, bytes: Uint8Array) {
  if (contentType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  if (contentType === "image/webp") return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

export async function isAllowedImageFile(file: Blob) {
  if (!isAllowedImageType(file.type)) return false;
  return isAllowedImageBytes(file.type, new Uint8Array(await file.slice(0, 12).arrayBuffer()));
}

import { artistWatermark } from "./watermark";
import { addImageRights } from "./image-rights";
import { protectedImageKey } from "./protected-image-key";
import { env } from "cloudflare:workers";
import { PhotonImage, SamplingFilter, resize, watermark } from "@cf-wasm/photon/workerd";

// Versioned derivatives keep originals private and avoid repeated image processing.
export async function protectedImage(key: string, artistName: string) {
  const publicKey = await protectedImageKey(key, artistName);
  let object = await env.BUCKET.get(publicKey);
  if (!object) {
    const source = await env.BUCKET.get(key);
    if (!source) return new Response("Not found", { status: 404 });
    let original: PhotonImage | undefined;
    let preview: PhotonImage | undefined;
    let mark: PhotonImage | undefined;
    try {
      original = PhotonImage.new_from_byteslice(new Uint8Array(await source.arrayBuffer()));
      const scale = Math.min(1, 1200 / Math.max(original.get_width(), original.get_height()));
      const width = Math.max(1, Math.round(original.get_width() * scale));
      const height = Math.max(1, Math.round(original.get_height() * scale));
      preview = resize(original, width, height, SamplingFilter.Lanczos3);
      const rendered = await artistWatermark(artistName, width);
      mark = PhotonImage.new_from_byteslice(rendered.bytes);
      for (const fraction of [.25, .5, .75]) {
        watermark(preview, mark, BigInt(0), BigInt(Math.max(0, Math.round(height * fraction - rendered.height / 2))));
      }
      await env.BUCKET.put(publicKey, addImageRights(preview.get_bytes_webp(), width, height, artistName), { httpMetadata: { contentType: "image/webp" } });
    } catch (error) {
      console.error("Protected image generation failed", error);
      // Never expose the original when processing fails.
      return new Response("Image temporarily unavailable", { status: 503 });
    } finally {
      original?.free(); preview?.free(); mark?.free();
    }
    object = await env.BUCKET.get(publicKey);
  }
  if (!object) return new Response("Image temporarily unavailable", { status: 503 });
  return new Response(object.body, { headers: { "content-type": "image/webp", "cache-control": "public, max-age=300", "x-content-type-options": "nosniff", "x-robots-tag": "noindex, noimageindex, noarchive" } });
}


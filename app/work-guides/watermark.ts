import { env } from "cloudflare:workers";
import { Resvg } from "@cf-wasm/resvg/workerd";

const escapeXml = (value: string) => value.replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[char]!));
let fontPromise: Promise<Uint8Array> | undefined;
function loadFont() {
  return fontPromise ??= (env as unknown as { ASSETS: { fetch(input: string): Promise<Response> } }).ASSETS.fetch("https://artist-map.com/fonts/NotoSansKR.ttf").then(async (response) => {
    if (!response.ok) throw new Error("Watermark font unavailable");
    return new Uint8Array(await response.arrayBuffer());
  }).catch((error) => { fontPromise = undefined; throw error; });
}

export async function artistWatermark(artistName: string, width: number) {
  const label = `© ${artistName.trim()} · artist-map.com`;
  const size = Math.max(8, Math.min(30, width * .78 / Math.max(1, Array.from(label).length)));
  const height = Math.ceil(size * 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><text x="50%" y="65%" text-anchor="middle" font-family="Noto Sans KR" font-size="${size}" fill="white" fill-opacity=".42" stroke="black" stroke-opacity=".28" stroke-width=".7" paint-order="stroke">${escapeXml(label)}</text></svg>`;
  const renderer = await Resvg.async(svg, { font: { fontBuffers: [await loadFont()], loadSystemFonts: false, defaultFontFamily: "Noto Sans KR" } });
  try {
    const image = renderer.render();
    try { return { bytes: image.asPng(), height }; } finally { image.free(); }
  } finally { renderer.free(); }
}

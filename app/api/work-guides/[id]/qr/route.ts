import QRCode from "qrcode";
import { ensureWorkGuidesTable, getGuide } from "../../../../work-guides/db";

export const runtime = "edge";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureWorkGuidesTable();
  const guide = await getGuide(id);
  if (!guide?.published_title) return new Response("Not found", { status: 404 });
  const url = `${new URL(request.url).origin}/w/${encodeURIComponent(id)}`;
  const svg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#111827", light: "#ffffff" } });
  return new Response(svg, { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" } });
}

import { liveApiContext } from "../../../lib/live-api-context";
import { protectedImage } from "../../../work-guides/protected-image";
import { serveArtistImage } from "./handlers";

export const runtime = "edge";

export async function GET(request: Request) {
  return serveArtistImage(request, liveApiContext(), protectedImage);
}

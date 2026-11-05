import { liveApiContext } from "../../lib/live-api-context";
import { recordStat } from "./handlers";

export const runtime = "edge";

export async function POST(request: Request) {
  return recordStat(request, liveApiContext());
}

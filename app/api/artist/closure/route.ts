import { liveApiContext } from "../../../lib/live-api-context";
import { changeClosure } from "./handlers";

export const runtime = "edge";

export async function POST(request: Request) {
  return changeClosure(request, liveApiContext());
}

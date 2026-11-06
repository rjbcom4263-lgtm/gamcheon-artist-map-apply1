import { liveApiContext } from "../../../lib/live-api-context";
import { logIn } from "./handlers";

export const runtime = "edge";

export async function POST(request: Request) {
  return logIn(request, liveApiContext());
}

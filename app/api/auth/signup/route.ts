import { liveApiContext } from "../../../lib/live-api-context";
import { signUp } from "./handlers";

export const runtime = "edge";

export async function POST(request: Request) {
  return signUp(request, liveApiContext());
}

import { liveApiContext } from "../../lib/live-api-context";
import { submitApplication } from "./handlers";

export const runtime = "edge";

export async function POST(request: Request) {
  return submitApplication(request, liveApiContext());
}

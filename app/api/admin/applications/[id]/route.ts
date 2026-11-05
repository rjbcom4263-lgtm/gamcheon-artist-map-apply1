import { liveApiContext } from "../../../../lib/live-api-context";
import { deleteApplication, updateApplicationStatus } from "./handlers";

export const runtime = "edge";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return updateApplicationStatus(request, (await context.params).id, liveApiContext());
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  return deleteApplication((await context.params).id, liveApiContext());
}

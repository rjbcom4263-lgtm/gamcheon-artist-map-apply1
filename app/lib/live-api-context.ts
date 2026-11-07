import { env } from "cloudflare:workers";
import { requireSession } from "../admin/admin-auth";
import type { ApiContext } from "./api-context";

/** 운영에서 쓰는 ApiContext입니다. route.ts가 처리 함수에 넘겨줍니다. */
export function liveApiContext(): ApiContext {
  return { DB: env.DB, BUCKET: env.BUCKET, session: () => requireSession() };
}

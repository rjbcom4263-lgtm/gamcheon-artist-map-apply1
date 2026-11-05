import type { SessionUser } from "../admin/admin-auth";

// API 처리 함수가 쓰는 자원입니다. 처리 함수가 cloudflare:workers를 직접 가져오지 않고 이 값을 받으면, 운영에서는
// live-api-context.ts가, 시험에서는 tests/helpers/api-context.mts가 채워 넣어 같은 코드를 그대로 돌릴 수 있습니다.
type WorkerEnv = typeof import("cloudflare:workers").env;

export type ApiContext = Pick<WorkerEnv, "DB" | "BUCKET"> & {
  /** 이 요청을 보낸 사람. 로그인하지 않았으면 null. */
  session: () => Promise<SessionUser | null>;
};

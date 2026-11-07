import { sha256Hex } from "../admin/password-hash.ts";
import type { ApiContext } from "./api-context";

// 로그인·가입 시도를 세어 너무 많으면 잠시 막습니다. 비밀번호 계산 전에 막아 공격 요청이 서버 비용을 쓰지 않게 합니다.
//  - 아이디만으로는 세지 않습니다. 다른 사람이 일부러 틀려서 작가의 계정을 잠글 수 있기 때문입니다.
//  - 첫 시도부터 잰 고정 시간 창을 쓰고, 막혀 있는 동안의 요청은 세지 않아 차단이 끝없이 늘어나지 않습니다.
//  - 저장소가 실패하면 막지 않고 로그만 남깁니다. 보호 장치 때문에 아무도 로그인하지 못하는 일이 더 나쁩니다.
const WINDOW_SECONDS = 10 * 60;
const PAIR_LIMIT = 5;
const IP_LIMIT = 20;
const SIGNUP_LIMIT = 10;
const CLEANUP_CHANCE = 0.05;

type Db = ApiContext["DB"];
type Counter = { key: string; limit: number };

const now = () => Math.floor(Date.now() / 1000);

// Cloudflare가 넣어 주는 값만 믿습니다. 사용자가 보낼 수 있는 일반 전달 헤더는 쓰지 않습니다. 로컬 개발에는 이 헤더가 없습니다.
const clientIp = (request: Request) => request.headers.get("cf-connecting-ip") || "local";
// 원문 IP와 아이디가 저장되지 않게 합니다. 세션 서명 값을 그대로 쓰지 않도록 용도 문자열을 섞습니다.
const counterKey = (...parts: string[]) => sha256Hex(JSON.stringify(["auth-attempt", process.env.ADMIN_SESSION_SECRET || "", ...parts]));

async function guarded<T>(fallback: T, work: () => Promise<T>) {
  try {
    return await work();
  } catch (error) {
    console.error("auth attempt storage failed", error);
    return fallback;
  }
}

function attempts(db: Db, counters: Counter[]) {
  return {
    /** 지금 막혀 있으면 남은 초를, 아니면 0을 돌려줍니다. */
    blockedFor: () => guarded(0, async () => {
      const at = now();
      const { results } = await db.prepare(`SELECT key, count, window_ends_at FROM auth_attempts WHERE key IN (${counters.map(() => "?").join(", ")})`)
        .bind(...counters.map(({ key }) => key)).all<{ key: string; count: number; window_ends_at: number }>();
      return results.reduce((seconds, row) => {
        const limit = counters.find(({ key }) => key === row.key)?.limit ?? Infinity;
        return row.count >= limit ? Math.max(seconds, row.window_ends_at - at) : seconds;
      }, 0);
    }),
    /** 한 번 더 셉니다. SQL 한 문장으로 올려 동시 요청에도 횟수가 어긋나지 않습니다. */
    count: () => guarded(undefined, async () => {
      const at = now();
      await db.batch(counters.map(({ key }) => db.prepare(`INSERT INTO auth_attempts (key, count, window_ends_at) VALUES (?, 1, ?)
        ON CONFLICT(key) DO UPDATE SET
          count = CASE WHEN window_ends_at <= ? THEN 1 ELSE count + 1 END,
          window_ends_at = CASE WHEN window_ends_at <= ? THEN excluded.window_ends_at ELSE window_ends_at END`).bind(key, at + WINDOW_SECONDS, at, at)));
      if (Math.random() < CLEANUP_CHANCE) await db.prepare("DELETE FROM auth_attempts WHERE window_ends_at <= ?").bind(at).run();
    }),
  };
}

/** 로그인 시도. IP와 아이디 묶음, IP 단독 두 기준으로 셉니다. */
export async function loginAttempts(db: Db, request: Request, loginId: string) {
  const ip = clientIp(request);
  const pair = await counterKey("login-pair", ip, loginId);
  return {
    ...attempts(db, [{ key: pair, limit: PAIR_LIMIT }, { key: await counterKey("login-ip", ip), limit: IP_LIMIT }]),
    /** 성공하면 묶음 기록만 지웁니다. IP 기록을 남겨, 자기 계정 로그인을 끼워 넣어 횟수를 지우는 우회를 막습니다. */
    succeed: () => guarded(undefined, async () => {
      await db.prepare("DELETE FROM auth_attempts WHERE key = ?").bind(pair).run();
    }),
  };
}

/** 가입 시도. IP 단독으로 셉니다. */
export async function signupAttempts(db: Db, request: Request) {
  return attempts(db, [{ key: await counterKey("signup-ip", clientIp(request)), limit: SIGNUP_LIMIT }]);
}

/** 막혔을 때의 응답. 아이디가 있는지와 관계없이 같습니다. */
export function tooManyAttempts(seconds: number, action: string) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return Response.json(
    { error: `${action}을 너무 여러 번 시도했습니다. 약 ${minutes}분 뒤에 다시 시도해 주세요.` },
    { status: 429, headers: { "retry-after": String(seconds) } },
  );
}

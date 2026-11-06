import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { hashPassword } from "../app/admin/password-hash.ts";
import { logIn } from "../app/api/auth/login/handlers.ts";
import { signUp } from "../app/api/auth/signup/handlers.ts";
import { SIGNUP_PRIVACY_VERSION } from "../app/signup/privacy-consent.ts";
import { apiServer } from "./helpers/api-context.mts";

const IP = "203.0.113.7";
const PASSWORD = "정확한-비밀번호-1";
const passwordHash = hashPassword(PASSWORD);
type Server = ReturnType<typeof apiServer>;

async function serverWithAccounts(...loginIds: string[]) {
  const server = apiServer();
  for (const loginId of loginIds) {
    await server.DB.prepare("INSERT INTO accounts (id, login_id, password_hash, role, status, display_name) VALUES (?, ?, ?, 'artist', 'active', ?)")
      .bind(`ACC-${loginId}`, loginId, await passwordHash, loginId).run();
  }
  return server;
}
const json = (body: unknown, ip: string | null = IP, extra: Record<string, string> = {}) => new Request("https://site.test/api/auth", {
  method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...(ip ? { "cf-connecting-ip": ip } : {}), ...extra },
});
const attempt = (server: Server, loginId: string, password = "틀린-비밀번호", ip: string | null = IP, extra?: Record<string, string>) =>
  logIn(json({ loginId, password }, ip, extra), server.as(null));
async function failTimes(server: Server, times: number, loginId: string, ip: string | null = IP) {
  for (let index = 0; index < times; index += 1) assert.equal((await attempt(server, loginId, "틀린-비밀번호", ip)).status, 401);
}
const useClock = (t: TestContext, at = "2026-11-06T00:00:00Z") => t.mock.timers.enable({ apis: ["Date"], now: Date.parse(at) });
const MINUTE = 60_000;

test("맞는 비밀번호로 로그인하면 세션 쿠키를 준다", async () => {
  const server = await serverWithAccounts("artist1");
  const response = await attempt(server, "artist1", PASSWORD);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, role: "artist", redirectTo: "/" });
  assert.match(response.headers.get("set-cookie")!, /^gamcheon_session=session-ACC-artist1;.*HttpOnly/);
});

test("틀린 비밀번호와 없는 아이디는 같은 응답을 받는다", async () => {
  const server = await serverWithAccounts("artist1");
  const wrong = await attempt(server, "artist1");
  const missing = await attempt(server, "nobody");
  assert.equal(wrong.status, 401);
  assert.equal(missing.status, 401);
  assert.deepEqual(await wrong.json(), await missing.json());
});

test("아이디나 비밀번호가 글자가 아니면 오류 없이 거절한다", async () => {
  const server = await serverWithAccounts("artist1");
  for (const body of [{}, { loginId: "artist1" }, { loginId: { a: 1 }, password: PASSWORD }, { loginId: "artist1", password: 123 }, null]) {
    assert.equal((await logIn(json(body), server.as(null))).status, 401, JSON.stringify(body));
  }
});

test("정지·삭제된 계정은 맞는 비밀번호로도 들어오지 못한다", async () => {
  const server = await serverWithAccounts("artist1");
  await server.DB.prepare("UPDATE accounts SET status = 'suspended' WHERE login_id = 'artist1'").run();
  assert.equal((await attempt(server, "artist1", PASSWORD)).status, 401);
});

test("옛 형식 비밀번호는 로그인에 성공할 때 새 형식으로 바꾼다", async () => {
  const server = apiServer();
  const old = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(PASSWORD)))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  await server.DB.prepare("INSERT INTO accounts (id, login_id, password_hash, role, status) VALUES ('ACC-old', 'old', ?, 'artist', 'active')").bind(old).run();
  assert.equal((await attempt(server, "old", PASSWORD)).status, 200);
  const row = await server.DB.prepare("SELECT password_hash FROM accounts WHERE id = 'ACC-old'").first() as { password_hash: string } | null;
  assert.match(row!.password_hash, /^pbkdf2-sha256\$/);
});

test("환경변수 관리자는 활성 관리자 계정이 없을 때만 들어오고 같은 제한을 받는다", async (t) => {
  const saved = { name: process.env.ADMIN_USERNAME, hash: process.env.ADMIN_PASSWORD_HASH };
  t.after(() => { process.env.ADMIN_USERNAME = saved.name ?? ""; process.env.ADMIN_PASSWORD_HASH = saved.hash ?? ""; });
  process.env.ADMIN_USERNAME = "owner";
  process.env.ADMIN_PASSWORD_HASH = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(PASSWORD)))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const server = apiServer();
  assert.equal((await attempt(server, "owner", PASSWORD)).status, 200);

  await failTimes(server, 5, "owner");
  assert.equal((await attempt(server, "owner", PASSWORD)).status, 429);

  const closed = apiServer();
  await closed.DB.prepare("INSERT INTO accounts (id, login_id, password_hash, role, status) VALUES ('ACC-a', 'real-admin', 'x', 'admin', 'active')").run();
  assert.equal((await attempt(closed, "owner", PASSWORD)).status, 401);
});

test("같은 곳에서 한 아이디로 5번 틀리면 맞는 비밀번호도 막고, 언제 다시 할 수 있는지 알려 준다", async (t) => {
  useClock(t);
  const server = await serverWithAccounts("artist1");
  await failTimes(server, 5, "artist1");
  t.mock.timers.tick(MINUTE);

  const blocked = await attempt(server, "artist1", PASSWORD);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("retry-after"), "540");
  const body = await blocked.json() as { error: string; retryAfterSeconds: number };
  assert.equal(body.retryAfterSeconds, 540);
  assert.match(body.error, /약 9분 뒤/);
  assert.equal(blocked.headers.get("set-cookie"), null);
});

test("4번 틀린 뒤에는 아직 맞는 비밀번호로 들어올 수 있다", async () => {
  const server = await serverWithAccounts("artist1");
  await failTimes(server, 4, "artist1");
  assert.equal((await attempt(server, "artist1", PASSWORD)).status, 200);
});

test("막힌 응답은 아이디가 있는지 알려 주지 않는다", async (t) => {
  useClock(t);
  const server = await serverWithAccounts("artist1");
  await failTimes(server, 5, "artist1");
  await failTimes(server, 5, "nobody");
  const real = await attempt(server, "artist1");
  const fake = await attempt(server, "nobody");
  assert.equal(real.status, 429);
  assert.equal(fake.status, 429);
  assert.deepEqual(await real.json(), await fake.json());
});

test("막혀 있으면 비밀번호 계산을 하지 않는다", async (t) => {
  const server = await serverWithAccounts("artist1");
  await failTimes(server, 5, "artist1");
  const derive = t.mock.method(crypto.subtle, "deriveBits");
  assert.equal((await attempt(server, "artist1", PASSWORD)).status, 429);
  assert.equal(derive.mock.callCount(), 0);
});

test("10분이 지나면 다시 시도할 수 있고, 막혀 있는 동안의 요청은 차단을 늘리지 않는다", async (t) => {
  useClock(t);
  const server = await serverWithAccounts("artist1");
  await failTimes(server, 5, "artist1");
  t.mock.timers.tick(9 * MINUTE);
  assert.equal((await attempt(server, "artist1")).status, 429);
  t.mock.timers.tick(MINUTE);
  assert.equal((await attempt(server, "artist1", PASSWORD)).status, 200);
});

test("차단은 첫 실패부터 잰 10분으로 끝나고, 나중의 실패로 늘어나지 않는다", async (t) => {
  useClock(t);
  const server = await serverWithAccounts("artist1");
  await failTimes(server, 4, "artist1");
  t.mock.timers.tick(5 * MINUTE);
  await failTimes(server, 1, "artist1");
  const blocked = await attempt(server, "artist1", PASSWORD);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("retry-after"), "300");
  t.mock.timers.tick(5 * MINUTE);
  assert.equal((await attempt(server, "artist1", PASSWORD)).status, 200);
});

test("시간 창이 끝나면 횟수를 새로 센다", async (t) => {
  useClock(t);
  const server = await serverWithAccounts("artist1");
  await failTimes(server, 4, "artist1");
  t.mock.timers.tick(10 * MINUTE);
  await failTimes(server, 4, "artist1");
  assert.equal((await attempt(server, "artist1", PASSWORD)).status, 200);
});

test("로그인에 성공하면 그 아이디의 실패 횟수를 지운다", async () => {
  const server = await serverWithAccounts("artist1");
  await failTimes(server, 4, "artist1");
  assert.equal((await attempt(server, "artist1", PASSWORD)).status, 200);
  await failTimes(server, 4, "artist1");
  assert.equal((await attempt(server, "artist1", PASSWORD)).status, 200);
});

test("다른 곳에서 일부러 틀려도 작가 본인은 로그인할 수 있다", async () => {
  const server = await serverWithAccounts("artist1");
  await failTimes(server, 5, "artist1", "198.51.100.9");
  assert.equal((await attempt(server, "artist1", "틀린-비밀번호", "198.51.100.9")).status, 429);
  assert.equal((await attempt(server, "artist1", PASSWORD, IP)).status, 200);
});

test("같은 곳에서 여러 아이디를 번갈아 20번 틀리면 모두 막는다", async () => {
  const server = await serverWithAccounts("artist1");
  for (let index = 0; index < 20; index += 1) assert.equal((await attempt(server, `guess-${index}`)).status, 401, String(index));
  assert.equal((await attempt(server, "artist1", PASSWORD)).status, 429);
  assert.equal((await attempt(server, "artist1", PASSWORD, "198.51.100.9")).status, 200);
});

test("자기 계정 로그인을 끼워 넣어도 IP 횟수는 지워지지 않는다", async () => {
  const server = await serverWithAccounts("artist1");
  for (let round = 0; round < 4; round += 1) {
    for (let index = 0; index < 5; index += 1) await attempt(server, `guess-${round}-${index}`);
    if (round < 3) assert.equal((await attempt(server, "artist1", PASSWORD)).status, 200);
  }
  assert.equal((await attempt(server, "artist1", PASSWORD)).status, 429);
});

test("사용자가 보낸 전달 헤더로는 IP를 바꿔 제한을 피할 수 없다", async () => {
  const server = await serverWithAccounts("artist1");
  for (let index = 0; index < 5; index += 1) await attempt(server, "artist1", "틀린-비밀번호", IP, { "x-forwarded-for": `10.0.0.${index}`, "x-real-ip": `10.0.1.${index}` });
  assert.equal((await attempt(server, "artist1", PASSWORD, IP, { "x-forwarded-for": "10.9.9.9" })).status, 429);
});

test("원문 IP와 아이디, 비밀번호를 저장하지 않는다", async () => {
  const server = await serverWithAccounts("artist1");
  await attempt(server, "secret-login-id", "틀린-비밀번호");
  const { results } = await server.DB.prepare("SELECT * FROM auth_attempts").all();
  assert.equal(results.length, 2);
  const stored = JSON.stringify(results);
  assert.ok(!stored.includes(IP));
  assert.ok(!stored.includes("secret-login-id"));
  assert.ok(!stored.includes("틀린-비밀번호"));
});

test("지난 기록은 가끔 함께 지워 쌓이지 않는다", async (t) => {
  useClock(t);
  const server = await serverWithAccounts("artist1");
  await attempt(server, "old-id");
  t.mock.timers.tick(10 * MINUTE);
  const count = async () => (await server.DB.prepare("SELECT COUNT(*) AS n FROM auth_attempts").first() as { n: number })!.n;
  const random = t.mock.method(Math, "random", () => 0.99);
  await attempt(server, "next-id", "틀린-비밀번호", "198.51.100.9");
  assert.equal(await count(), 4);
  random.mock.mockImplementation(() => 0);
  await attempt(server, "next-id", "틀린-비밀번호", "198.51.100.9");
  assert.equal(await count(), 2);
});

test("시도 기록 저장이 실패해도 로그인은 되고 로그를 남긴다", async (t) => {
  const logged = t.mock.method(console, "error", () => {});
  const server = await serverWithAccounts("artist1");
  await server.DB.prepare("DROP TABLE auth_attempts").run();
  assert.equal((await attempt(server, "artist1")).status, 401);
  assert.equal((await attempt(server, "artist1", PASSWORD)).status, 200);
  assert.ok(logged.mock.callCount() >= 3);
  assert.equal(logged.mock.calls[0].arguments[0], "auth attempt storage failed");
});

const signupBody = (loginId: string, extra: object = {}) => ({ loginId, password: "새-비밀번호-12", displayName: "작가", phone: "010-0000-0000", consentRequired: true, privacyVersion: SIGNUP_PRIVACY_VERSION, ...extra });
const join = (server: Server, body: object, ip: string = IP) => signUp(json(body, ip), server.as(null));

test("가입하면 계정과 동의 기록을 만들고 세션을 준다", async () => {
  const server = apiServer();
  const response = await join(server, signupBody("new1"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, role: "artist", redirectTo: "/artist" });
  assert.match(response.headers.get("set-cookie")!, /^gamcheon_session=session-ACC-/);
  const row = await server.DB.prepare("SELECT a.status, c.version FROM accounts a JOIN account_privacy_consents c ON c.account_id = a.id WHERE a.login_id = 'new1'").first();
  assert.deepEqual({ ...row }, { status: "pending", version: SIGNUP_PRIVACY_VERSION });
});

test("입력을 고치는 요청은 세지 않아 정상 가입자가 막히지 않는다", async () => {
  const server = apiServer();
  for (let index = 0; index < 15; index += 1) {
    assert.equal((await join(server, signupBody("new1", { password: "짧음" }))).status, 400);
  }
  assert.equal((await join(server, signupBody("new1"))).status, 200);
});

test("같은 곳에서 10번 가입하면 잠시 막고, 다른 곳과 시간이 지난 뒤에는 된다", async (t) => {
  useClock(t);
  const server = apiServer();
  for (let index = 0; index < 10; index += 1) assert.equal((await join(server, signupBody(`new${index}`))).status, 200, String(index));

  const blocked = await join(server, signupBody("new-blocked"));
  assert.equal(blocked.status, 429);
  assert.match((await blocked.json() as { error: string }).error, /가입을 너무 여러 번/);
  assert.equal(await server.DB.prepare("SELECT 1 FROM accounts WHERE login_id = 'new-blocked'").first(), null);

  assert.equal((await join(server, signupBody("new-other"), "198.51.100.9")).status, 200);
  t.mock.timers.tick(10 * MINUTE);
  assert.equal((await join(server, signupBody("new-later"))).status, 200);
});

test("이미 있는 아이디로 가입을 반복해 아이디를 찾아보면 막는다", async () => {
  const server = await serverWithAccounts("artist1");
  for (let index = 0; index < 10; index += 1) assert.equal((await join(server, signupBody("artist1"))).status, 409, String(index));
  assert.equal((await join(server, signupBody("artist1"))).status, 429);
});

test("로그인 횟수와 가입 횟수는 서로 영향을 주지 않는다", async () => {
  const server = await serverWithAccounts("artist1");
  for (let index = 0; index < 20; index += 1) await attempt(server, `guess-${index}`);
  assert.equal((await join(server, signupBody("new1"))).status, 200);
});

test("가입 기록 저장이 실패해도 가입은 된다", async (t) => {
  t.mock.method(console, "error", () => {});
  const server = apiServer();
  await server.DB.prepare("DROP TABLE auth_attempts").run();
  assert.equal((await join(server, signupBody("new1"))).status, 200);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { changeClosure } from "../app/api/artist/closure/handlers.ts";
import { defaultStudioHours } from "../app/lib/studio-hours.ts";
import { apiServer, user } from "./helpers/api-context.mts";

const owner = user("owner");
const press = (action: string) => {
  const form = new FormData();
  form.set("action", action);
  return new Request("https://site.test/api/artist/closure", { method: "POST", body: form });
};
const hoursOf = async (server: ReturnType<typeof apiServer>, id = "GA-1") => JSON.parse((await server.application(id))!.payload_json).studioHours;

async function withHours(studioHours: object = defaultStudioHours()) {
  const server = apiServer();
  await server.addApplication("GA-1", { accountId: "owner", payload: { studioHours, values: { tagline: "유지될 값" } } });
  return server;
}

test("로그인한 작가만 쓸 수 있다", async () => {
  const server = await withHours();
  for (const viewer of [null, user("boss", "admin")]) {
    assert.equal((await changeClosure(press("today"), server.as(viewer))).status, 403);
  }
  assert.equal((await hoursOf(server)).closure, undefined);
});

test("오늘 임시 휴무를 켜면 한국 날짜 하루로 저장하고 작가 페이지로 돌아간다", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-11-05T15:30:00Z") });
  const server = await withHours();
  const response = await changeClosure(press("today"), server.as(owner));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/artist#channels");
  const hours = await hoursOf(server);
  assert.deepEqual(hours.closure, { from: "2026-11-06", until: "2026-11-06", note: "" });
  assert.deepEqual(hours.weekly, defaultStudioHours().weekly);
  assert.equal(JSON.parse((await server.application("GA-1"))!.payload_json).values.tagline, "유지될 값");
});

test("임시 휴무를 해제하면 요일별 시간은 남기고 휴무만 지운다", async () => {
  const server = await withHours({ ...defaultStudioHours(), closure: { from: "2026-11-05", until: "2026-11-05", note: "전시" } });
  assert.equal((await changeClosure(press("clear"), server.as(owner))).status, 303);
  const hours = await hoursOf(server);
  assert.equal(hours.closure, undefined);
  assert.deepEqual(hours.weekly, defaultStudioHours().weekly);
});

test("모르는 동작은 아무것도 바꾸지 않는다", async () => {
  const closure = { from: "2026-11-05", until: "2026-11-05", note: "전시" };
  const server = await withHours({ ...defaultStudioHours(), closure });
  assert.equal((await changeClosure(press("delete-everything"), server.as(owner))).status, 303);
  assert.deepEqual((await hoursOf(server)).closure, closure);
});

test("요일별 시간을 쓰지 않는 작가는 아무것도 바뀌지 않는다", async () => {
  const server = apiServer();
  await server.addApplication("GA-1", { accountId: "owner", payload: { values: {} } });
  assert.equal((await changeClosure(press("today"), server.as(owner))).status, 303);
  assert.equal(await hoursOf(server), undefined);
});

test("승인된 신청서가 없으면 아무것도 바꾸지 않는다", async () => {
  const server = apiServer();
  await server.addApplication("GA-1", { accountId: "owner", status: "received", payload: { studioHours: defaultStudioHours() } });
  assert.equal((await changeClosure(press("today"), server.as(owner))).status, 303);
  assert.equal((await hoursOf(server)).closure, undefined);
});

test("다른 작가의 휴무는 바꾸지 못한다", async () => {
  const server = await withHours();
  await server.addApplication("GA-2", { accountId: "other", payload: { studioHours: defaultStudioHours() } });
  await changeClosure(press("today"), server.as(user("other")));
  assert.equal((await hoursOf(server, "GA-1")).closure, undefined);
  assert.ok((await hoursOf(server, "GA-2")).closure);
});

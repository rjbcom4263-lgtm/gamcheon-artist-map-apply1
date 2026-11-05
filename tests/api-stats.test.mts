import assert from "node:assert/strict";
import { test } from "node:test";
import { recordStat } from "../app/api/stats/handlers.ts";
import { apiServer, user } from "./helpers/api-context.mts";

const ARTIST = "GA-20261105-ABC123";
const GUIDE = "WG-12345678-1234-1234-1234-123456789abc";
const send = (body: unknown) => new Request("https://site.test/api/stats", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });

async function withArtist() {
  const server = apiServer();
  await server.addApplication(ARTIST, { accountId: "owner" });
  await server.addGuide(GUIDE, { applicationId: ARTIST, accountId: "owner" });
  return server;
}

test("방문객이 작가 페이지를 열면 하루 합계로 센다", async () => {
  const server = await withArtist();
  for (let index = 0; index < 2; index++) {
    assert.equal((await recordStat(send({ kind: "view", id: ARTIST }), server.as(null))).status, 204);
  }
  const rows = await server.stats();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].application_id, ARTIST);
  assert.equal(rows[0].kind, "view");
  assert.equal(rows[0].target, "");
  assert.equal(rows[0].count, 2);
});

test("작품 해설 열람은 작품별로 그 작가의 QR 수로 센다", async () => {
  const server = await withArtist();
  await recordStat(send({ kind: "qr", id: GUIDE }), server.as(user("visitor")));
  const [row] = await server.stats();
  assert.equal(row.application_id, ARTIST);
  assert.equal(row.kind, "qr");
  assert.equal(row.target, GUIDE);
  assert.equal(row.count, 1);
});

test("한국 날짜로 기록한다", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-11-05T15:30:00Z") });
  const server = await withArtist();
  await recordStat(send({ kind: "view", id: ARTIST }), server.as(null));
  assert.equal((await server.stats())[0].day, "2026-11-06");
});

test("작가 본인과 운영자가 본 것은 세지 않고, 다른 작가가 본 것은 센다", async () => {
  const server = await withArtist();
  await recordStat(send({ kind: "view", id: ARTIST }), server.as(user("owner")));
  await recordStat(send({ kind: "qr", id: GUIDE }), server.as(user("owner")));
  await recordStat(send({ kind: "view", id: ARTIST }), server.as(user("boss", "admin")));
  assert.deepEqual(await server.stats(), []);

  await recordStat(send({ kind: "view", id: ARTIST }), server.as(user("another-artist")));
  assert.equal((await server.stats()).length, 1);
});

test("승인되지 않은 작가나 공개되지 않은 작품 해설은 세지 않는다", async () => {
  const server = apiServer();
  await server.addApplication(ARTIST, { status: "received" });
  await server.addGuide(GUIDE, { applicationId: ARTIST, published: false });
  await recordStat(send({ kind: "view", id: ARTIST }), server.as(null));
  await recordStat(send({ kind: "qr", id: GUIDE }), server.as(null));
  assert.deepEqual(await server.stats(), []);
});

test("번호 형식이 다르면 저장돼 있어도 세지 않는다", async () => {
  const server = apiServer();
  await server.addApplication("GA-1");
  await server.addGuide("WG-1", { applicationId: "GA-1" });
  await recordStat(send({ kind: "view", id: "GA-1" }), server.as(null));
  await recordStat(send({ kind: "qr", id: "WG-1" }), server.as(null));
  assert.deepEqual(await server.stats(), []);
});

test("잘못된 요청은 오류 없이 무시한다", async () => {
  const server = await withArtist();
  const bad = ["{broken", {}, { kind: "view" }, { kind: "view", id: 123 }, { kind: "view", id: GUIDE }, { kind: "qr", id: ARTIST }, { kind: "other", id: ARTIST }, { kind: "view", id: "GA-20261105-ZZZZZZ" }, { kind: "view", id: `${ARTIST}' OR 1=1` }];
  for (const body of bad) assert.equal((await recordStat(send(body), server.as(null))).status, 204);
  assert.deepEqual(await server.stats(), []);
});

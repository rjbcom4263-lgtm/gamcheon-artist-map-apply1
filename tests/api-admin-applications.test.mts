import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { deleteApplication, updateApplicationStatus } from "../app/api/admin/applications/[id]/handlers.ts";
import { apiServer, user } from "./helpers/api-context.mts";

const admin = user("boss", "admin");
const patch = (body: object) => new Request("https://site.test/api/admin/applications/GA-1", { method: "PATCH", body: JSON.stringify(body) });

test("신청서 삭제는 운영자만 할 수 있다", async () => {
  const server = apiServer();
  await server.addApplication("GA-1");
  for (const viewer of [null, user("owner")]) {
    assert.equal((await deleteApplication("GA-1", server.as(viewer))).status, 403);
  }
  assert.ok(await server.application("GA-1"));
});

test("없는 신청서를 지우면 404다", async () => {
  const server = apiServer();
  assert.equal((await deleteApplication("GA-none", server.as(admin))).status, 404);
});

test("신청서를 지우면 기록된 사진과 남아 있던 사진을 모두 지우고, 다른 신청서 사진은 남긴다", async () => {
  const server = apiServer();
  await server.addApplication("GA-1", { images: [{ type: "profile", key: "applications/GA-1/a.webp" }, { type: "gallery", key: "applications/GA-2/stolen.webp" }] });
  for (const key of ["applications/GA-1/a.webp", "applications/GA-1/b.webp", "applications/GA-1/c.webp", "applications/GA-2/stolen.webp"]) await server.BUCKET.put(key, "x");

  const response = await deleteApplication("GA-1", server.as(admin));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, deletedImages: 3, deletedGuides: 0 });
  assert.equal(await server.application("GA-1"), null);
  assert.deepEqual(server.BUCKET.keys(), ["applications/GA-2/stolen.webp"]);
});

test("신청서를 지우면 그 작가의 방문 통계도 지우고, 다른 작가 통계는 남긴다", async () => {
  const server = apiServer();
  await server.addApplication("GA-1");
  await server.addStat("GA-1", "view");
  await server.addStat("GA-1", "qr", "WG-1");
  await server.addStat("GA-2", "view");

  assert.equal((await deleteApplication("GA-1", server.as(admin))).status, 200);
  assert.deepEqual((await server.stats()).map((row) => row.application_id), ["GA-2"]);
});

test("없는 신청서를 지우려 해도 다른 데이터는 건드리지 않는다", async () => {
  const server = apiServer();
  await server.addStat("GA-1", "view");
  assert.equal((await deleteApplication("GA-none", server.as(admin))).status, 404);
  assert.equal((await server.stats()).length, 1);
});

// 워터마크 사본의 저장 위치입니다. 코드와 따로 계산해, 규칙이 바뀌면 사본이 조용히 남는 일을 잡습니다.
const derivative = (key: string, artistName: string) =>
  `protected-images/v3/${createHash("sha256").update(`${key}:${artistName}`).digest("hex")}.webp`;

test("신청서를 지우면 그 작가의 작품 해설과 해설 사진을 함께 지우고, 다른 작가 것은 남긴다", async () => {
  const server = apiServer();
  await server.addApplication("GA-1", { accountId: "owner" });
  await server.addGuide("WG-1", { applicationId: "GA-1", publishedKey: "work-guides/WG-1/published.webp" });
  await server.addGuide("WG-2", { applicationId: "GA-1", published: false, pendingKey: "work-guides/WG-2/pending.webp" });
  await server.addGuide("WG-other", { applicationId: "GA-2", accountId: "other", publishedKey: "work-guides/WG-other/keep.webp" });
  for (const key of ["work-guides/WG-1/published.webp", "work-guides/WG-1/replaced-earlier.webp", "work-guides/WG-1/third.webp", "work-guides/WG-2/pending.webp", "work-guides/WG-other/keep.webp"]) await server.BUCKET.put(key, "x");

  const response = await deleteApplication("GA-1", server.as(admin));
  assert.deepEqual(await response.json(), { ok: true, deletedImages: 4, deletedGuides: 2 });
  assert.deepEqual(await server.guideIds(), ["WG-other"]);
  assert.deepEqual(server.BUCKET.keys(), ["work-guides/WG-other/keep.webp"]);
});

test("같은 계정의 다른 신청서에 연결된 해설은 남긴다", async () => {
  const server = apiServer();
  await server.addApplication("GA-old", { accountId: "owner", status: "rejected" });
  await server.addApplication("GA-new", { accountId: "owner", status: "approved" });
  await server.addGuide("WG-new", { applicationId: "GA-new", accountId: "owner", publishedKey: "work-guides/WG-new/keep.webp" });
  await server.BUCKET.put("work-guides/WG-new/keep.webp", "x");
  assert.equal((await deleteApplication("GA-old", server.as(admin))).status, 200);
  assert.deepEqual(await server.guideIds(), ["WG-new"]);
  assert.deepEqual(server.BUCKET.keys(), ["work-guides/WG-new/keep.webp"]);
});

test("저장소 목록을 읽지 못해도 기록된 사진은 지우고 삭제를 끝낸다", async (t) => {
  t.mock.method(console, "error", () => {});
  const server = apiServer();
  await server.addApplication("GA-1", { images: [{ type: "profile", key: "applications/GA-1/a.webp" }] });
  await server.addGuide("WG-1", { applicationId: "GA-1", publishedKey: "work-guides/WG-1/p.webp", pendingKey: "work-guides/WG-1/q.webp" });
  for (const key of ["applications/GA-1/a.webp", "work-guides/WG-1/p.webp", "work-guides/WG-1/q.webp"]) await server.BUCKET.put(key, "x");
  const context = server.as(admin);
  const failing = { ...context, BUCKET: { delete: context.BUCKET.delete, list: async () => { throw new Error("list failed"); } } } as unknown as typeof context;

  const response = await deleteApplication("GA-1", failing);
  assert.deepEqual(await response.json(), { ok: true, deletedImages: 3, deletedGuides: 1 });
  assert.deepEqual(server.BUCKET.keys(), []);
});

test("해설에 기록된 사진이라도 그 해설 폴더 밖의 파일은 지우지 않는다", async () => {
  const server = apiServer();
  await server.addApplication("GA-1");
  await server.addGuide("WG-1", { applicationId: "GA-1", publishedKey: "work-guides/WG-other/keep.webp" });
  await server.BUCKET.put("work-guides/WG-other/keep.webp", "x");
  await deleteApplication("GA-1", server.as(admin));
  assert.deepEqual(server.BUCKET.keys(), ["work-guides/WG-other/keep.webp"]);
});

test("신청서 사진과 해설 사진의 워터마크 사본도 지우고, 다른 작가 사본은 남긴다", async () => {
  const server = apiServer();
  const appKey = "applications/GA-1/a.webp";
  const guideKey = "work-guides/WG-1/published.webp";
  await server.addApplication("GA-1", { name: "신청 작가명", images: [{ type: "profile", key: appKey }] });
  await server.addGuide("WG-1", { applicationId: "GA-1", artistName: "해설 작가명", publishedKey: guideKey });
  const other = derivative("applications/GA-2/b.webp", "다른 작가");
  for (const key of [appKey, guideKey, derivative(appKey, "신청 작가명"), derivative(guideKey, "해설 작가명"), other]) await server.BUCKET.put(key, "x");

  assert.equal((await deleteApplication("GA-1", server.as(admin))).status, 200);
  assert.deepEqual(server.BUCKET.keys(), [other]);
});

test("저장소에만 남은 신청서 사진의 워터마크 사본도 지운다", async () => {
  const server = apiServer();
  const leftover = "applications/GA-1/not-recorded.webp";
  await server.addApplication("GA-1", { name: "작가" });
  await server.BUCKET.put(leftover, "x");
  await server.BUCKET.put(derivative(leftover, "작가"), "x");
  await deleteApplication("GA-1", server.as(admin));
  assert.deepEqual(server.BUCKET.keys(), []);
});

test("없는 신청서를 지우려 하면 그 번호에 연결된 해설도 건드리지 않는다", async () => {
  const server = apiServer();
  await server.addGuide("WG-1", { applicationId: "GA-none", publishedKey: "work-guides/WG-1/a.webp" });
  await server.BUCKET.put("work-guides/WG-1/a.webp", "x");
  assert.equal((await deleteApplication("GA-none", server.as(admin))).status, 404);
  assert.deepEqual(await server.guideIds(), ["WG-1"]);
  assert.deepEqual(server.BUCKET.keys(), ["work-guides/WG-1/a.webp"]);
});

test("DB 삭제가 실패하면 하나도 지우지 않고 사진도 남긴다", async () => {
  const server = apiServer();
  await server.addApplication("GA-1", { images: [{ type: "profile", key: "applications/GA-1/a.webp" }] });
  await server.addGuide("WG-1", { applicationId: "GA-1", publishedKey: "work-guides/WG-1/a.webp" });
  await server.addStat("GA-1");
  for (const key of ["applications/GA-1/a.webp", "work-guides/WG-1/a.webp"]) await server.BUCKET.put(key, "x");
  const context = server.as(admin);
  const failing = { ...context, DB: { prepare: (sql: string) => context.DB.prepare(sql.replace("DELETE FROM artist_daily_stats", "DELETE FROM missing_table")), batch: (statements: never) => context.DB.batch(statements) } } as typeof context;

  await assert.rejects(deleteApplication("GA-1", failing));
  assert.ok(await server.application("GA-1"));
  assert.deepEqual(await server.guideIds(), ["WG-1"]);
  assert.equal((await server.stats()).length, 1);
  assert.equal(server.BUCKET.keys().length, 2);
});

test("상태 변경은 운영자만 할 수 있다", async () => {
  const server = apiServer();
  await server.addApplication("GA-1", { status: "received" });
  assert.equal((await updateApplicationStatus(patch({ status: "approved" }), "GA-1", server.as(user("owner")))).status, 403);
  assert.equal((await server.application("GA-1"))?.status, "received");
});

test("없는 상태값이나 사유 없는 반려는 거부한다", async () => {
  const server = apiServer();
  await server.addApplication("GA-1", { status: "received" });
  for (const body of [{}, { status: "draft" }, { status: "rejected" }, { status: "cancelled", reviewNote: "   " }]) {
    assert.equal((await updateApplicationStatus(patch(body), "GA-1", server.as(admin))).status, 400);
  }
  assert.equal((await server.application("GA-1"))?.status, "received");
  assert.equal((await updateApplicationStatus(patch({ status: "approved" }), "GA-none", server.as(admin))).status, 404);
});

test("처음 승인하면 지도 공개를 꺼 두고, 이미 정한 값은 바꾸지 않는다", async () => {
  const server = apiServer();
  await server.addApplication("GA-1", { status: "received", payload: { values: { tagline: "한 줄" } } });
  await server.addApplication("GA-2", { accountId: "other", status: "received", payload: { values: { mapPublished: true } } });

  assert.equal((await updateApplicationStatus(patch({ status: "approved" }), "GA-1", server.as(admin))).status, 200);
  await updateApplicationStatus(patch({ status: "approved" }), "GA-2", server.as(admin));

  const first = JSON.parse((await server.application("GA-1"))!.payload_json);
  assert.deepEqual(first.values, { tagline: "한 줄", mapPublished: false });
  assert.equal(first.adminReview.status, "approved");
  assert.equal(JSON.parse((await server.application("GA-2"))!.payload_json).values.mapPublished, true);
});

test("이미 승인된 신청서는 상태를 다시 저장해도 지도 공개 설정이 그대로다", async () => {
  const server = apiServer();
  await server.addApplication("GA-1", { status: "approved", payload: { values: {} } });
  await updateApplicationStatus(patch({ status: "approved", reviewNote: "확인" }), "GA-1", server.as(admin));
  const payload = JSON.parse((await server.application("GA-1"))!.payload_json);
  assert.equal(payload.values.mapPublished, undefined);
  assert.equal(payload.adminReview.note, "확인");
});

test("상태 변경 응답은 저장된 값을 돌려주고 사유 앞뒤 공백을 지운다", async () => {
  const server = apiServer();
  await server.addApplication("GA-1", { status: "received" });
  const response = await updateApplicationStatus(patch({ status: "rejected", reviewNote: "  서류 부족  " }), "GA-1", server.as(admin));
  const body = await response.json() as { status: string; payload_json: string };
  assert.equal(body.status, "rejected");
  assert.equal(JSON.parse(body.payload_json).adminReview.note, "서류 부족");
  assert.equal((await server.application("GA-1"))?.payload_json, body.payload_json);
});

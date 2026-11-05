import assert from "node:assert/strict";
import { test } from "node:test";
import { findPublicArtist, listPublicArtists, publicArtistCounts } from "../app/artists/public-artist-query.ts";
import { apiServer } from "./helpers/api-context.mts";

const visible = { values: { mapPublished: true, studioName: "감천 작업실" }, works: [{ title: "하나" }, { title: "둘" }] };

async function artist(values: { status?: string; accountStatus?: string | null; payload?: object } = {}) {
  const server = apiServer();
  if (values.accountStatus !== null) await server.addAccount("owner", values.accountStatus ?? "active");
  await server.addApplication("GA-1", { accountId: "owner", status: values.status ?? "approved", payload: values.payload ?? visible });
  return server;
}
const db = (server: ReturnType<typeof apiServer>) => server.DB as never;
const ids = async (server: ReturnType<typeof apiServer>) => (await listPublicArtists(db(server))).map((row) => row.id);

test("승인되고 활성인 작가는 공개된다", async () => {
  const server = await artist();
  const row = await findPublicArtist(db(server), "GA-1");
  assert.equal(row?.id, "GA-1");
  assert.equal(row?.artist_name, "작가");
  assert.equal(row?.account_id, "owner");
  assert.deepEqual(await ids(server), ["GA-1"]);
});

for (const status of ["draft", "received", "reviewing", "hold", "rejected", "cancelled"]) {
  test(`신청서가 ${status} 상태면 공개되지 않는다`, async () => {
    const server = await artist({ status });
    assert.equal(await findPublicArtist(db(server), "GA-1"), null);
    assert.deepEqual(await ids(server), []);
  });
}

for (const accountStatus of ["suspended", "deleted"]) {
  test(`계정이 ${accountStatus} 상태면 공개되지 않는다`, async () => {
    const server = await artist({ accountStatus });
    assert.equal(await findPublicArtist(db(server), "GA-1"), null);
    assert.deepEqual(await ids(server), []);
  });
}

test("지도 공개를 끈 작가는 공개되지 않는다", async () => {
  const server = await artist({ payload: { values: { mapPublished: false } } });
  assert.equal(await findPublicArtist(db(server), "GA-1"), null);
  assert.deepEqual(await ids(server), []);
});

test("지도 공개 값이 없는 예전 신청서는 지금 지도처럼 공개된다", async () => {
  const server = await artist({ payload: { values: {} } });
  assert.equal((await findPublicArtist(db(server), "GA-1"))?.id, "GA-1");
});

test("내용을 읽을 수 없는 신청서도 조회를 망가뜨리지 않는다", async () => {
  const server = await artist();
  await server.DB.prepare("UPDATE artist_applications SET payload_json = '{broken' WHERE id = 'GA-1'").run();
  assert.equal((await findPublicArtist(db(server), "GA-1"))?.id, "GA-1");
  assert.deepEqual(await ids(server), ["GA-1"]);
});

test("계정 기록이 없는 예전 신청서는 그대로 공개된다", async () => {
  const server = await artist({ accountStatus: null });
  assert.equal((await findPublicArtist(db(server), "GA-1"))?.id, "GA-1");
});

test("다시 공개하거나 계정을 되살리면 그대로 돌아온다", async () => {
  const server = await artist({ accountStatus: "suspended", status: "rejected" });
  await server.setApplicationStatus("GA-1", "approved");
  assert.equal(await findPublicArtist(db(server), "GA-1"), null);
  await server.setAccountStatus("owner", "active");
  assert.equal((await findPublicArtist(db(server), "GA-1"))?.id, "GA-1");
});

test("목록은 최근 신청 순으로 100명까지 보여 주고 전화번호는 가져오지 않는다", async () => {
  const server = apiServer();
  for (let index = 0; index < 103; index++) {
    await server.addApplication(`GA-${String(index).padStart(3, "0")}`, { accountId: `account-${index}`, payload: visible });
    await server.DB.prepare("UPDATE artist_applications SET created_at = ?, phone = '010-0000-0000' WHERE id = ?").bind(`2026-01-01 00:${String(index % 60).padStart(2, "0")}:${String(Math.floor(index / 60)).padStart(2, "0")}`, `GA-${String(index).padStart(3, "0")}`).run();
  }
  const rows = await listPublicArtists(db(server));
  assert.equal(rows.length, 100);
  assert.equal(rows[0].id, "GA-059");
  assert.ok(rows.every((row) => !("phone" in row)));
});

test("홈 통계는 공개 작가만 센다", async () => {
  const server = await artist();
  await server.addAccount("hidden");
  await server.addApplication("GA-hidden", { accountId: "hidden", name: "숨긴 작가", payload: { values: { mapPublished: false, studioName: "숨김 작업실" }, works: [{}, {}, {}] } });
  await server.addAccount("gone", "deleted");
  await server.addApplication("GA-gone", { accountId: "gone", name: "삭제된 작가", payload: { values: { studioName: "삭제 작업실" }, works: [{}] } });
  await server.addAccount("waiting");
  await server.addApplication("GA-waiting", { accountId: "waiting", name: "대기 작가", status: "received", payload: { values: { studioName: "대기 작업실" }, works: [{}] } });

  assert.deepEqual(await publicArtistCounts(db(server)), { artists: 1, works: 2, spaces: 1 });
});

test("홈 통계는 같은 작가와 같은 작업실을 한 번만 세고, 읽을 수 없는 내용은 건너뛴다", async () => {
  const server = apiServer();
  await server.addAccount("a");
  await server.addApplication("GA-a", { accountId: "a", name: "같은 작가", payload: { values: { studioName: " 감천 " }, works: [{}] } });
  await server.addAccount("b");
  await server.addApplication("GA-b", { accountId: "b", name: "같은 작가", payload: { values: { studioName: "감천" }, works: [{}, {}] } });
  await server.addAccount("c");
  await server.addApplication("GA-c", { accountId: "c", name: "다른 작가" });
  await server.DB.prepare("UPDATE artist_applications SET payload_json = '{broken' WHERE id = 'GA-c'").run();

  assert.deepEqual(await publicArtistCounts(db(server)), { artists: 2, works: 3, spaces: 1 });
});

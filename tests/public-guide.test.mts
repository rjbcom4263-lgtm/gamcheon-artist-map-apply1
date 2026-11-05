import assert from "node:assert/strict";
import { test } from "node:test";
import { findPublicGuide, listPublicGuides } from "../app/work-guides/public-guide.ts";
import { apiServer } from "./helpers/api-context.mts";

const GUIDE = "WG-1";

async function published(applicationStatus = "approved", accountStatus: string | null = "active") {
  const server = apiServer();
  if (accountStatus) await server.addAccount("owner", accountStatus);
  await server.addApplication("GA-1", { accountId: "owner", status: applicationStatus });
  await server.addGuide(GUIDE, { applicationId: "GA-1", accountId: "owner" });
  return server;
}

test("승인된 작가의 공개한 해설은 보인다", async () => {
  const server = await published();
  const guide = await findPublicGuide(server.DB as never, GUIDE);
  assert.equal(guide?.id, GUIDE);
  assert.equal(guide?.published_title, `작품 ${GUIDE}`);
  assert.equal(guide?.application_id, "GA-1");
  assert.equal(guide?.artist_name, "작가");
  assert.deepEqual(await listPublicGuides(server.DB as never, "GA-1"), [{ id: GUIDE, title: `작품 ${GUIDE}` }]);
});

for (const status of ["received", "reviewing", "hold", "rejected", "cancelled"]) {
  test(`신청서가 ${status} 상태면 해설을 숨긴다`, async () => {
    const server = await published(status);
    assert.equal(await findPublicGuide(server.DB as never, GUIDE), null);
    assert.deepEqual(await listPublicGuides(server.DB as never, "GA-1"), []);
  });
}

for (const status of ["suspended", "deleted"]) {
  test(`계정이 ${status} 상태면 해설을 숨긴다`, async () => {
    const server = await published("approved", status);
    assert.equal(await findPublicGuide(server.DB as never, GUIDE), null);
    assert.deepEqual(await listPublicGuides(server.DB as never, "GA-1"), []);
  });
}

test("다시 승인하거나 계정을 되살리면 같은 해설이 다시 보인다", async () => {
  const server = await published();
  await server.setApplicationStatus("GA-1", "rejected");
  await server.setAccountStatus("owner", "suspended");
  assert.equal(await findPublicGuide(server.DB as never, GUIDE), null);

  await server.setApplicationStatus("GA-1", "approved");
  assert.equal(await findPublicGuide(server.DB as never, GUIDE), null);
  await server.setAccountStatus("owner", "active");
  assert.equal((await findPublicGuide(server.DB as never, GUIDE))?.id, GUIDE);
});

test("계정 기록이 없어도 승인된 신청서의 해설은 그대로 보인다", async () => {
  const server = await published("approved", null);
  assert.equal((await findPublicGuide(server.DB as never, GUIDE))?.id, GUIDE);
});

test("내용이 빠진 해설이나 없는 신청서의 해설은 숨긴다", async () => {
  const server = await published();
  await server.addGuide("WG-unpublished", { applicationId: "GA-1", published: false });
  await server.addGuide("WG-no-description", { applicationId: "GA-1", publishedDescription: null });
  await server.addGuide("WG-orphan", { applicationId: "GA-gone" });
  for (const id of ["WG-unpublished", "WG-no-description", "WG-orphan", "WG-none"]) {
    assert.equal(await findPublicGuide(server.DB as never, id), null);
  }
});

test("목록은 그 신청서의 공개 해설만, 최근 공개 순으로 12개까지 보여 준다", async () => {
  const server = await published();
  await server.addApplication("GA-2", { accountId: "other" });
  await server.addGuide("WG-other", { applicationId: "GA-2", accountId: "other" });
  await server.addGuide("WG-late", { applicationId: "GA-1", publishedAt: "2026-11-05T00:00:00Z" });
  await server.addGuide("WG-early", { applicationId: "GA-1", publishedAt: "2026-01-01T00:00:00Z" });
  const ids = (await listPublicGuides(server.DB as never, "GA-1")).map((guide) => guide.id);
  assert.deepEqual(ids.slice(0, 2), ["WG-late", "WG-early"]);
  assert.ok(!ids.includes("WG-other"));

  for (let index = 0; index < 15; index++) await server.addGuide(`WG-more-${index}`, { applicationId: "GA-1" });
  assert.equal((await listPublicGuides(server.DB as never, "GA-1")).length, 12);
});

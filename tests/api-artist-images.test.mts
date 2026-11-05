import assert from "node:assert/strict";
import { test } from "node:test";
import { serveArtistImage } from "../app/api/artists/images/handlers.ts";
import { apiServer, user } from "./helpers/api-context.mts";

const KEY = "applications/GA-1/photo.webp";
const request = (key = KEY) => new Request(`https://site.test/api/artists/images?key=${encodeURIComponent(key)}`);

// 실제 워터마크 처리는 Worker에서만 돌므로, 무엇을 넘겼는지와 응답만 봅니다.
function renderer() {
  const calls: Array<[string, string]> = [];
  const render = async (key: string, artistName: string) => {
    calls.push([key, artistName]);
    return new Response("image", { headers: { "content-type": "image/webp", "cache-control": "public, max-age=300" } });
  };
  return { calls, render };
}

async function artist(values: { status?: string; accountStatus?: string; payload?: object } = {}) {
  const server = apiServer();
  await server.addAccount("owner", values.accountStatus ?? "active");
  await server.addApplication("GA-1", { accountId: "owner", name: "작가명", status: values.status ?? "approved", payload: values.payload ?? { values: { mapPublished: true } }, images: [{ type: "profile", key: KEY }] });
  return server;
}
const hidden = { payload: { values: { mapPublished: false } } };

test("공개 작가의 이미지는 누구나 받고 캐시된다", async () => {
  const server = await artist();
  const { calls, render } = renderer();
  const response = await serveArtistImage(request(), server.as(null), render);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, max-age=300");
  assert.deepEqual(calls, [[KEY, "작가명"]]);
});

test("숨긴 작가의 이미지는 방문객과 다른 작가가 받을 수 없다", async () => {
  const server = await artist(hidden);
  const { calls, render } = renderer();
  for (const viewer of [null, user("another-artist")]) {
    assert.equal((await serveArtistImage(request(), server.as(viewer), render)).status, 404);
  }
  assert.deepEqual(calls, []);
});

test("정지·삭제된 계정의 이미지는 방문객이 받을 수 없다", async () => {
  for (const accountStatus of ["suspended", "deleted"]) {
    const server = await artist({ accountStatus });
    const { render } = renderer();
    assert.equal((await serveArtistImage(request(), server.as(null), render)).status, 404);
  }
});

test("숨겨진 동안에도 작가 본인과 운영자는 볼 수 있고, 캐시되지 않는다", async () => {
  const server = await artist(hidden);
  for (const viewer of [user("owner"), user("boss", "admin")]) {
    const { render } = renderer();
    const response = await serveArtistImage(request(), server.as(viewer), render);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("content-type"), "image/webp");
    assert.equal(await response.text(), "image");
  }
});

test("승인되지 않은 신청서의 사진은 이 경로로 받을 수 없다", async () => {
  const server = await artist({ status: "received" });
  for (const viewer of [null, user("owner"), user("boss", "admin")]) {
    const { render } = renderer();
    assert.equal((await serveArtistImage(request(), server.as(viewer), render)).status, 404);
  }
});

test("신청서에 기록되지 않은 파일은 받을 수 없다", async () => {
  const server = await artist();
  const { render } = renderer();
  assert.equal((await serveArtistImage(request("applications/GA-1/not-listed.webp"), server.as(user("owner")), render)).status, 404);
});

test("키 형식이 틀리면 400이고, 없는 신청서는 404다", async () => {
  const server = await artist();
  const { render } = renderer();
  for (const key of ["", "work-guides/WG-1/a.webp", "applications/../secret"]) {
    assert.equal((await serveArtistImage(request(key), server.as(null), render)).status, 400);
  }
  assert.equal((await serveArtistImage(request("applications/GA-none/a.webp"), server.as(null), render)).status, 404);
});

test("공개 작가 이미지는 로그인 확인을 하지 않는다", async () => {
  const server = await artist();
  const { render } = renderer();
  const context = { ...server.as(null), session: async () => { throw new Error("session must not be read"); } };
  assert.equal((await serveArtistImage(request(), context, render)).status, 200);
});

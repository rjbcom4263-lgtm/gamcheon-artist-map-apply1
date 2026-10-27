// 실행: npm test  (Node 22의 타입 제거 모드로 .ts를 직접 불러옵니다)
import assert from "node:assert/strict";
import { test } from "node:test";
import { PASSWORD_HASH_ITERATIONS, generateTemporaryPassword, hashPassword, safeEqual, sha256Hex, verifyPassword } from "../app/admin/password-hash.ts";

test("hashPassword는 pbkdf2-sha256$반복$솔트$해시 형식을 만든다", async () => {
  const stored = await hashPassword("비밀번호 test!");
  const parts = stored.split("$");
  assert.equal(parts.length, 4);
  assert.equal(parts[0], "pbkdf2-sha256");
  assert.equal(Number(parts[1]), PASSWORD_HASH_ITERATIONS);
  assert.ok(parts[2].length >= 20 && parts[3].length >= 40);
});

test("같은 비밀번호라도 솔트가 달라 해시가 다르다", async () => {
  assert.notEqual(await hashPassword("same"), await hashPassword("same"));
});

test("verifyPassword는 맞는 비밀번호만 통과시키고 새 형식은 재해시가 필요 없다", async () => {
  const stored = await hashPassword("correct horse");
  assert.deepEqual(await verifyPassword("correct horse", stored), { ok: true, needsRehash: false });
  assert.equal((await verifyPassword("correct horsf", stored)).ok, false);
  assert.equal((await verifyPassword("", stored)).ok, false);
});

test("옛 SHA-256 hex 해시도 받아들이되 needsRehash를 표시한다", async () => {
  const legacy = await sha256Hex("1234");
  assert.deepEqual(await verifyPassword("1234", legacy), { ok: true, needsRehash: true });
  assert.equal((await verifyPassword("0000", legacy)).ok, false);
});

test("깨진 저장값은 조용히 거부한다", async () => {
  assert.equal((await verifyPassword("x", "pbkdf2-sha256$abc$$")).ok, false);
  assert.equal((await verifyPassword("x", "pbkdf2-sha256$100000$!!!$???")).ok, false);
  assert.equal((await verifyPassword("x", "")).ok, false);
});

test("safeEqual은 길이가 다르거나 내용이 다르면 false", () => {
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
  assert.equal(safeEqual("abc", "ab"), false);
});

test("generateTemporaryPassword는 헷갈리는 글자 없이 요청한 길이를 만든다", () => {
  for (let i = 0; i < 20; i++) {
    const value = generateTemporaryPassword();
    assert.equal(value.length, 12);
    assert.doesNotMatch(value, /[0OoI1l]/);
  }
  assert.equal(generateTemporaryPassword(20).length, 20);
});

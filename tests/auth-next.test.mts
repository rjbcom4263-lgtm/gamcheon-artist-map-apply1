import assert from "node:assert/strict";
import { test } from "node:test";
import { pathWithNext, safeNextCookie, safeNextPath } from "../app/auth-next.ts";

test("safeNextPath는 사이트 안 경로만 통과시킨다", () => {
  assert.equal(safeNextPath("/artist"), "/artist");
  assert.equal(safeNextPath("/apply?step=2"), "/apply?step=2");
  assert.equal(safeNextPath("https://evil.example/"), "/");
  assert.equal(safeNextPath("//evil.example/"), "/");
  assert.equal(safeNextPath("/ok\\evil"), "/");
  assert.equal(safeNextPath("/ok\r\nSet-Cookie: x"), "/");
  assert.equal(safeNextPath(undefined, "/login"), "/login");
  assert.equal(safeNextPath(42), "/");
});

test("safeNextCookie는 URL 인코딩을 풀고 같은 규칙을 적용한다", () => {
  assert.equal(safeNextCookie(encodeURIComponent("/artist/profile")), "/artist/profile");
  assert.equal(safeNextCookie(encodeURIComponent("//evil.example")), "/");
  assert.equal(safeNextCookie("%E0%A4%A"), "/");
});

test("pathWithNext는 next 값을 인코딩해 붙인다", () => {
  assert.equal(pathWithNext("/login", "/apply?step=2"), "/login?next=%2Fapply%3Fstep%3D2");
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { MIN_PASSWORD_LENGTH, isReservedLoginId, passwordProblem } from "../app/lib/account-rules.ts";

test("소셜 로그인용 아이디 형식은 일반 가입에서 막는다", () => {
  assert.equal(isReservedLoginId("google_1234567890"), true);
  assert.equal(isReservedLoginId("KAKAO_99"), true);
  assert.equal(isReservedLoginId("  naver_abc"), true);
  assert.equal(isReservedLoginId("googler"), false);
  assert.equal(isReservedLoginId("my_google_id"), false);
  assert.equal(isReservedLoginId("artist01"), false);
});

test("비밀번호는 8자 이상 200자 이하, 앞뒤 공백 불가", () => {
  assert.equal(passwordProblem("a".repeat(MIN_PASSWORD_LENGTH)), null);
  assert.equal(passwordProblem("비밀번호 여덟자!"), null);
  assert.match(passwordProblem("1234567") || "", /8자 이상/);
  assert.match(passwordProblem("") || "", /8자 이상/);
  assert.match(passwordProblem("a".repeat(201)) || "", /200자 이하/);
  assert.match(passwordProblem(" leading8") || "", /공백/);
  assert.match(passwordProblem("trailing8 ") || "", /공백/);
});

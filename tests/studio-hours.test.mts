import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultStudioHours, formatWeekly, readStudioHours, sanitizeStudioHours, studioStatus, type StudioHours } from "../app/lib/studio-hours.ts";

// 2026-11-04(수) 한국 시간을 UTC로 바꿔 넘깁니다.
const kst = (time: string, date = "2026-11-04") => new Date(`${date}T${time}:00+09:00`);
const hours = (): StudioHours => defaultStudioHours(); // 월 휴무, 화–일 10:00–18:00

test("요일별 시간으로 지금 방문 가능 여부를 계산한다", () => {
  assert.equal(studioStatus(hours(), "운영시간 내 방문 가능", kst("09:30")).state, "before");
  assert.equal(studioStatus(hours(), "운영시간 내 방문 가능", kst("10:00")).state, "open");
  assert.equal(studioStatus(hours(), "운영시간 내 방문 가능", kst("17:59")).detail, "18:00까지");
  assert.equal(studioStatus(hours(), "운영시간 내 방문 가능", kst("18:00")).state, "after");
  const monday = studioStatus(hours(), "운영시간 내 방문 가능", kst("12:00", "2026-11-02"));
  assert.equal(monday.state, "dayoff");
  assert.equal(monday.detail, "내일 10:00에 열어요");
});

test("한국 날짜가 바뀌는 자정 무렵에도 한국 요일로 본다", () => {
  // UTC로는 일요일 15:30이지만 한국은 월요일 00:30
  assert.equal(studioStatus(hours(), "", new Date("2026-11-01T15:30:00Z")).state, "dayoff");
});

test("임시 휴무가 가장 먼저, 그다음 방문 방식을 본다", () => {
  const closed = { ...hours(), closure: { from: "2026-11-04", until: "2026-11-06", note: "전시 준비" } };
  const status = studioStatus(closed, "운영시간 내 방문 가능", kst("12:00"));
  assert.equal(status.state, "closure");
  assert.equal(status.detail, "11/6까지 쉬어요 · 전시 준비");
  assert.equal(studioStatus(closed, "", kst("12:00", "2026-11-07")).state, "open");
  assert.equal(studioStatus(hours(), "사전 예약 필요", kst("12:00")).state, "reservation");
  assert.equal(studioStatus(hours(), "일반 방문 불가", kst("12:00")).state, "noVisit");
});

test("같은 시간이 이어지는 요일은 묶어서 보여준다", () => {
  const value = hours();
  value.weekly.sat = { closed: false, open: "11:00", close: "17:00" };
  value.weekly.sun = { closed: false, open: "11:00", close: "17:00" };
  assert.equal(formatWeekly(value), "월 휴무 · 화–금 10:00–18:00 · 토–일 11:00–17:00");
});

test("잘못된 입력은 막고, 깨진 저장값은 무시한다", () => {
  const bad = hours();
  bad.weekly.tue = { closed: false, open: "18:00", close: "10:00" };
  assert.ok("error" in sanitizeStudioHours(bad));
  assert.ok("error" in sanitizeStudioHours({ ...hours(), closure: { from: "2026-11-06", until: "2026-11-04", note: "" } }));
  assert.equal(readStudioHours(bad), undefined);
  assert.equal(readStudioHours(undefined), undefined);
  const closedDay = hours();
  closedDay.weekly.tue = { closed: true, open: "", close: "" };
  assert.deepEqual((sanitizeStudioHours(closedDay) as StudioHours).weekly.tue, { closed: true, open: "10:00", close: "18:00" });
});

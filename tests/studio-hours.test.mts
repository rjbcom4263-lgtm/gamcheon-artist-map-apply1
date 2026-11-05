import assert from "node:assert/strict";
import { test } from "node:test";
import { closurePeriod, defaultStudioHours, formatWeekly, pendingClosure, placeStatusFields, readStudioHours, refreshPlaceStatuses, sanitizeStudioHours, studioStatus, type LivePlace, type StudioHours } from "../app/lib/studio-hours.ts";

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

test("다음 영업일을 안내할 때 임시 휴무 날짜는 건너뛴다", () => {
  const closedFrom = (from: string, until: string): StudioHours => ({ ...hours(), closure: { from, until, note: "" } });
  const detail = (value: StudioHours, at: Date) => studioStatus(value, "운영시간 내 방문 가능", at).detail;
  // 수요일 마감 후, 목·금 임시 휴무 → 토요일
  assert.equal(detail(closedFrom("2026-11-05", "2026-11-06"), kst("19:00")), "토요일 10:00에 열어요");
  // 월요일 정기 휴무, 화요일부터 긴 임시 휴무 → 한 주가 넘으면 날짜로 안내
  assert.equal(detail(closedFrom("2026-11-03", "2026-11-20"), kst("12:00", "2026-11-02")), "11/21(토) 10:00에 열어요");
  // 휴무가 끝난 다음 날(월)이 정기 휴무면 그다음 날
  assert.equal(detail(closedFrom("2026-11-05", "2026-11-08"), kst("19:00")), "화요일 10:00에 열어요");
  // 내일과 겹치지 않는 임시 휴무는 안내에 영향이 없다
  assert.equal(detail(closedFrom("2026-11-10", "2026-11-12"), kst("19:00")), "내일 10:00에 열어요");
  assert.equal(detail(closedFrom("2026-10-01", "2026-10-02"), kst("19:00")), "내일 10:00에 열어요");
});

test("운영일이 하나도 없으면 임시 휴무가 있어도 끝없이 찾지 않는다", () => {
  const value = hours();
  for (const day of Object.values(value.weekly)) day.closed = true;
  value.closure = { from: "2026-11-05", until: "2026-11-06", note: "" };
  assert.equal(studioStatus(value, "", kst("12:00")).detail, "운영일이 정해지지 않았어요");
});

test("지도 상태는 시간이 지나면 다시 계산하고, 바뀐 게 없으면 같은 배열을 돌려준다", () => {
  const place = { id: "a", visitType: "운영시간 내 방문 가능", studioHours: hours(), ...placeStatusFields(hours(), "운영시간 내 방문 가능", kst("17:59")) };
  const noHours = { id: "b", visitType: "방문 전 문의", hours: "글자 운영시간" };
  const places: LivePlace[] = [place, noHours];
  assert.equal(place.hours, "방문 가능 · 18:00까지");
  // 같은 문구면 지도에 다시 보내지 않도록 배열을 그대로 돌려준다
  assert.equal(refreshPlaceStatuses(places, kst("17:59")), places);
  const later = refreshPlaceStatuses(places, kst("18:00"));
  assert.notEqual(later, places);
  assert.equal(later[0].hours, "영업 종료 · 내일 10:00에 열어요");
  assert.deepEqual(later[0].status, { state: "after", label: "영업 종료" });
  assert.equal(later[1], noHours);
  // 자정을 넘겨 요일이 바뀐 경우
  assert.equal(refreshPlaceStatuses(places, kst("00:30", "2026-11-09"))[0].status?.state, "dayoff");
});

test("끝나지 않은 임시 휴무만 남아 있는 휴무로 본다", () => {
  const withClosure = (from: string, until: string): StudioHours => ({ ...hours(), closure: { from, until, note: "" } });
  assert.equal(pendingClosure(hours(), kst("12:00")), undefined);
  assert.equal(pendingClosure(withClosure("2026-11-01", "2026-11-03"), kst("12:00")), undefined);
  assert.equal(pendingClosure(withClosure("2026-11-04", "2026-11-04"), kst("23:59"))?.until, "2026-11-04");
  assert.equal(pendingClosure(withClosure("2026-12-01", "2026-12-05"), kst("12:00"))?.from, "2026-12-01");
  // UTC로는 11/3 15:30이지만 한국은 11/4 00:30
  assert.equal(pendingClosure(withClosure("2026-11-04", "2026-11-04"), new Date("2026-11-03T15:30:00Z"))?.from, "2026-11-04");
});

test("임시 휴무 기간을 짧게 쓴다", () => {
  assert.equal(closurePeriod({ from: "2026-11-20", until: "2026-11-20", note: "" }), "11/20");
  assert.equal(closurePeriod({ from: "2026-11-20", until: "2026-12-05", note: "" }), "11/20–12/5");
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

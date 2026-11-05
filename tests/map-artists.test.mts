import assert from "node:assert/strict";
import { test } from "node:test";
import { artistRowsToPlaces } from "../app/map/map-artists.ts";
import { locationPrivacyNote } from "../app/lib/location-privacy.ts";

// 일부러 끝자리를 눈에 띄게 둔 좌표입니다. 응답 어디에도 이 값이 나가면 안 되는 경우를 찾기 쉽습니다.
const LONGITUDE = 129.012345;
const LATITUDE = 35.095432;

function place(values: Record<string, unknown>) {
  const payload = { categories: ["회화"], values: { studioName: "감천 작업실", address: "감천동 1-2", mapLongitude: LONGITUDE, mapLatitude: LATITUDE, mapX: 41.5, mapY: 62.5, ...values } };
  const [result] = artistRowsToPlaces([{ id: "GA-1", artist_name: "작가", payload_json: JSON.stringify(payload), image_keys_json: "[]" }]);
  return result;
}

test("정확한 위치 공개에 동의한 작가만 정확한 핀과 주소가 나간다", () => {
  const result = place({ locationPrivacy: "exact" });
  assert.deepEqual(result.geoPosition, { longitude: LONGITUDE, latitude: LATITUDE });
  assert.deepEqual(result.position, { x: 41.5, y: 62.5 });
  assert.equal(result.locationMode, "exact");
  assert.equal(result.address, "감천동 1-2");
});

test("근처 위치만 공개하면 약 150m 격자의 가운데 좌표가 나간다", () => {
  // 손으로 계산한 값: 경도 격자 0.00165, 위도 격자 0.00135의 칸 가운데
  const result = place({ locationPrivacy: "nearby", mapLongitude: 129.01, mapLatitude: 35.095 });
  assert.deepEqual(result.geoPosition, { longitude: 129.009375, latitude: 35.095275 });
  assert.equal(result.locationMode, "approximate");
  assert.equal(result.address, "감천문화마을 일대");
});

test("같은 칸 안의 위치는 항상 같은 좌표로 나가 여러 번 봐도 원래 위치를 알 수 없다", () => {
  const first = place({ locationPrivacy: "nearby", mapLongitude: 129.0095, mapLatitude: 35.0952 });
  const second = place({ locationPrivacy: "nearby", mapLongitude: 129.0097, mapLatitude: 35.0958 });
  assert.deepEqual(first.geoPosition, { longitude: 129.009375, latitude: 35.095275 });
  assert.deepEqual(second.geoPosition, first.geoPosition);
});

test("근처 위치의 좌표는 원래 위치에서 약간 벗어나되 크게 멀어지지 않는다", () => {
  const { longitude, latitude } = place({ locationPrivacy: "nearby" }).geoPosition!;
  assert.notEqual(longitude, LONGITUDE);
  assert.notEqual(latitude, LATITUDE);
  assert.ok(Math.abs(longitude - LONGITUDE) <= 0.00165 / 2 + 1e-9);
  assert.ok(Math.abs(latitude - LATITUDE) <= 0.00135 / 2 + 1e-9);
});

for (const [name, values] of [
  ["근처 위치만 공개", { locationPrivacy: "nearby" }],
  ["예약 방문객에게만 안내", { locationPrivacy: "reservation" }],
  ["범위 값이 없는 경우", {}],
  ["알 수 없는 범위 값", { locationPrivacy: "somewhere" }],
] as const) {
  test(`${name}: 정확한 좌표와 주소가 응답 어디에도 나가지 않는다`, () => {
    const text = JSON.stringify(place(values));
    assert.ok(!text.includes(String(LONGITUDE)));
    assert.ok(!text.includes(String(LATITUDE)));
    assert.ok(!text.includes("감천동 1-2"));
    assert.ok(!text.includes("41.5"));
    assert.ok(!text.includes("62.5"));
    assert.equal(place(values).position, undefined);
  });
}

test("예약 방문객에게만 안내하면 핀을 내보내지 않는다", () => {
  const result = place({ locationPrivacy: "reservation" });
  assert.equal(result.geoPosition, undefined);
  assert.equal(result.locationMode, "hidden");
});

test("범위 값이 없거나 알 수 없으면 가장 보수적으로 핀을 내보내지 않는다", () => {
  for (const locationPrivacy of [undefined, "", "somewhere", 1]) {
    const result = place({ locationPrivacy });
    assert.equal(result.geoPosition, undefined);
    assert.equal(result.locationMode, "hidden");
  }
});

test("핀을 아직 찍지 않았으면 어떤 범위든 좌표가 없다", () => {
  for (const locationPrivacy of ["exact", "nearby"]) {
    const result = place({ locationPrivacy, mapLongitude: undefined, mapLatitude: undefined });
    assert.equal(result.geoPosition, undefined);
    assert.equal(result.locationMode, "unplaced");
  }
});

test("감천 밖의 잘못된 좌표는 범위와 관계없이 내보내지 않는다", () => {
  for (const locationPrivacy of ["exact", "nearby"]) {
    assert.equal(place({ locationPrivacy, mapLongitude: 127, mapLatitude: 37.5 }).geoPosition, undefined);
  }
});

test("운영자 화면 안내는 범위마다 공개 지도에 어떻게 나가는지 알려 준다", () => {
  assert.match(locationPrivacyNote("exact"), /찍은 위치 그대로/);
  assert.match(locationPrivacyNote("nearby"), /대략적인 위치/);
  assert.match(locationPrivacyNote("reservation"), /표시되지 않/);
  assert.match(locationPrivacyNote(""), /표시되지 않/);
  assert.match(locationPrivacyNote(undefined), /표시되지 않/);
});

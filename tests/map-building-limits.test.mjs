import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_EDIT_LIMITS } from '../app/map/map-building-limits.ts';

test('building edit API accepts the full drawable map area', () => {
  // 골목지도 GAMCHEON_MAP_BOUNDS의 네 가장자리 좌표.
  assert.ok(BUILDING_EDIT_LIMITS.west <= 128.9998058);
  assert.ok(BUILDING_EDIT_LIMITS.east >= 129.0173734);
  assert.ok(BUILDING_EDIT_LIMITS.south <= 35.0867957);
  assert.ok(BUILDING_EDIT_LIMITS.north >= 35.1022347);
});

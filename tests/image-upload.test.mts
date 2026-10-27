import assert from "node:assert/strict";
import { test } from "node:test";
import { applicationIdFromImageKey, isAllowedImageBytes, isAllowedImageType } from "../app/image-upload.ts";

test("applicationIdFromImageKey는 applications/{id}/{파일} 형식에서만 id를 꺼낸다", () => {
  assert.equal(applicationIdFromImageKey("applications/GA-20261027-AB12CD/work-1.webp"), "GA-20261027-AB12CD");
  assert.equal(applicationIdFromImageKey("applications/GA-1/a/b.webp"), null);
  assert.equal(applicationIdFromImageKey("applications/../secret.webp"), null);
  assert.equal(applicationIdFromImageKey("applications/GA-1/"), null);
  assert.equal(applicationIdFromImageKey("other/GA-1/a.webp"), null);
  assert.equal(applicationIdFromImageKey(""), null);
});

test("이미지 MIME 허용 목록과 매직 바이트 검사", () => {
  assert.equal(isAllowedImageType("image/png"), true);
  assert.equal(isAllowedImageType("image/svg+xml"), false);
  assert.equal(isAllowedImageBytes("image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])), true);
  assert.equal(isAllowedImageBytes("image/png", new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0])), false);
  assert.equal(isAllowedImageBytes("image/jpeg", new Uint8Array([0xff, 0xd8, 0xff])), true);
  assert.equal(isAllowedImageBytes("image/webp", new TextEncoder().encode("RIFF0000WEBPVP8 ")), true);
  assert.equal(isAllowedImageBytes("image/gif", new TextEncoder().encode("GIF89a")), false);
});

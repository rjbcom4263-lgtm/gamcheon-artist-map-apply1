import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_GALLERY_PHOTOS, galleryRecords, planGallery } from "../app/lib/studio-gallery.ts";

const existing = [
  { type: "profile", key: "applications/GA-1/p.jpg" },
  { type: "gallery", key: "applications/GA-1/a.jpg", caption: "입구" },
  { type: "gallery", key: "applications/GA-1/b.jpg" },
];

test("순서를 바꾸고 새 사진을 더하고, 빠진 사진은 지울 목록에 넣는다", () => {
  const plan = planGallery([
    { key: "applications/GA-1/b.jpg", caption: "  작업대  " },
    { upload: "galleryNew1", caption: "" },
  ], existing);
  assert.ok(!("error" in plan));
  assert.deepEqual(plan.items, [{ key: "applications/GA-1/b.jpg", caption: "작업대" }, { upload: "galleryNew1", caption: "" }]);
  assert.deepEqual(plan.removed, ["applications/GA-1/a.jpg"]);
});

test("갤러리에 없는 키(프로필·다른 작가 사진)와 이상한 업로드 필드는 막는다", () => {
  assert.ok("error" in planGallery([{ key: "applications/GA-1/p.jpg" }], existing));
  assert.ok("error" in planGallery([{ key: "applications/GA-2/x.jpg" }], existing));
  assert.ok("error" in planGallery([{ upload: "profileImage" }], existing));
  assert.ok("error" in planGallery("[]", existing));
});

test("같은 사진 중복과 최대 장수 초과를 막는다", () => {
  assert.ok("error" in planGallery([{ key: "applications/GA-1/a.jpg" }, { key: "applications/GA-1/a.jpg" }], existing));
  const many = Array.from({ length: MAX_GALLERY_PHOTOS + 1 }, (_, index) => ({ upload: `galleryNew${index}` }));
  assert.ok("error" in planGallery(many, existing));
  assert.ok(!("error" in planGallery(many.slice(0, MAX_GALLERY_PHOTOS), existing)));
});

test("빈 목록이면 모든 갤러리 사진을 지운다", () => {
  const plan = planGallery([], existing);
  assert.ok(!("error" in plan));
  assert.deepEqual(plan.removed, ["applications/GA-1/a.jpg", "applications/GA-1/b.jpg"]);
  assert.equal(galleryRecords(existing).length, 2);
});

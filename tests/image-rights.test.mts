import assert from "node:assert/strict";
import { test } from "node:test";
import { PhotonImage } from "@cf-wasm/photon/node";
import { addImageRights } from "../app/work-guides/image-rights.ts";

test("권리 정보를 추가해도 투명 WebP를 정상적으로 읽을 수 있다", () => {
  const pixels = new Uint8Array(64 * 32 * 4).fill(150);
  const source = new PhotonImage(pixels, 64, 32);
  try {
    const bytes = addImageRights(source.get_bytes_webp(), 64, 32, '홍길동 & <작가>');
    const output = PhotonImage.new_from_byteslice(bytes);
    try {
      assert.equal(output.get_width(), 64);
      assert.equal(output.get_height(), 32);
      assert.deepEqual(output.get_raw_pixels(), source.get_raw_pixels());
      assert.match(new TextDecoder().decode(bytes), /홍길동 &amp; &lt;작가&gt;/);
      assert.equal(new DataView(bytes.buffer).getUint32(4, true), bytes.length - 8);
    } finally { output.free(); }
  } finally { source.free(); }
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { submitApplication } from "../app/api/applications/handlers.ts";
import { updateApplicationStatus } from "../app/api/admin/applications/[id]/handlers.ts";
import { initialValues } from "../app/apply/apply-form.ts";
import { findPublicArtist } from "../app/artists/public-artist-query.ts";
import { APPLY_CONSENT_VERSION } from "../app/signup/privacy-consent.ts";
import { apiServer, user } from "./helpers/api-context.mts";

const ID = "GA-20261105-ABC123";
const OTHER_ID = "GA-20261105-DEF456";
const owner = user("owner");

type Payload = Record<string, unknown>;
type Server = ReturnType<typeof apiServer>;

const workKey = (index: number, id = ID) => `applications/${id}/work-${index}.webp`;
const profileKey = `applications/${ID}/profile.webp`;

async function putImage(server: Server, key: string, applicationId = ID) {
  await server.BUCKET.put(key, "image", { httpMetadata: { contentType: "image/webp" }, customMetadata: { applicationId } });
}

/** 정상적인 신청 화면이 올린 사진 6장이 준비된 초안을 만듭니다. */
async function draftServer() {
  const server = apiServer();
  await server.addApplication(ID, { accountId: "owner", status: "draft", name: "" });
  await putImage(server, profileKey);
  for (let index = 0; index < 5; index += 1) await putImage(server, workKey(index));
  return server;
}

const uploadedImages = () => [
  { type: "profile", key: profileKey, name: "profile.webp", contentType: "image/webp" },
  ...Array.from({ length: 5 }, (_, workIndex) => ({ type: "work", workIndex, key: workKey(workIndex), name: `${workIndex}.webp`, contentType: "image/webp" })),
];

/** 신청 화면이 보내는 모양 그대로의 값입니다. 항목 목록은 화면의 initialValues에서 가져와, 화면에 항목이 늘면 시험이 따라갑니다. */
function formValues(extra: Payload = {}): Payload {
  const filled = Object.fromEntries(Object.entries(initialValues).map(([key, value]) => [key, typeof value === "boolean" ? true : `${key} 내용`]));
  return { ...filled, consentVersion: APPLY_CONSENT_VERSION, ...extra };
}

function formPayload(overrides: Payload = {}): Payload {
  return {
    applicationId: ID,
    values: formValues(),
    categories: ["회화"],
    works: Array.from({ length: 5 }, (_, index) => ({ id: `w${index}`, title: `작품 ${index}`, status: "문의 필요", description: "설명" })),
    experiences: [{ id: "e1", title: "체험", status: "운영 중", description: "설명" }],
    expectedImages: { profile: true, works: [true, true, true, true, true] },
    uploadedImages: uploadedImages(),
    ...overrides,
  };
}

function send(payload: unknown, files: Record<string, File> = {}) {
  const form = new FormData();
  form.set("payload", typeof payload === "string" ? payload : JSON.stringify(payload));
  for (const [name, file] of Object.entries(files)) form.set(name, file);
  return new Request("https://site.test/api/applications", { method: "POST", body: form });
}

const stored = async (server: Server, id = ID) => JSON.parse((await server.application(id))!.payload_json);

test("로그인한 작가만 제출할 수 있다", async () => {
  const server = await draftServer();
  for (const viewer of [null, user("boss", "admin"), user("owner", "admin")]) {
    assert.equal((await submitApplication(send(formPayload()), server.as(viewer))).status, 403);
  }
  assert.equal((await server.application(ID))!.status, "draft");
});

test("정상적인 신청 화면이 보낸 항목과 동의 기록은 모두 그대로 저장된다", async () => {
  const server = await draftServer();
  const response = await submitApplication(send(formPayload()), server.as(owner));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { id: ID });

  const row = (await server.application(ID))!;
  assert.equal(row.status, "received");
  assert.equal(row.artist_name, "artistName 내용");
  assert.equal(row.phone, "phone 내용");
  assert.equal(row.email, "email 내용");

  const payload = await stored(server);
  assert.deepEqual(payload.values, formValues());
  assert.deepEqual(payload.categories, ["회화"]);
  assert.equal(payload.works.length, 5);
  assert.deepEqual(payload.experiences, [{ id: "e1", title: "체험", status: "운영 중", description: "설명" }]);
  assert.equal(JSON.parse(row.image_keys_json).length, 6);
});

const OPERATOR_VALUES = {
  mapPublished: true,
  mapLongitude: 129.0101,
  mapLatitude: 35.0975,
  mapX: 41.5,
  mapY: 62.5,
  verifiedAt: "2026-11-01",
  accessStairs: "없음",
  accessSlope: "완만",
  accessRestriction: "없음",
  accessNote: "휠체어 가능",
  somethingNew: "처음 보는 값",
};

test("지도 공개 여부, 좌표, 현장 확인일 같은 운영자 항목은 제출해도 저장되지 않는다", async () => {
  const server = await draftServer();
  const response = await submitApplication(send(formPayload({ values: formValues(OPERATOR_VALUES) })), server.as(owner));
  assert.equal(response.status, 201);
  const { values } = await stored(server);
  for (const key of Object.keys(OPERATOR_VALUES)) assert.equal(key in values, false, `${key}가 저장됐습니다`);
  assert.deepEqual(values, formValues());
});

test("운영 기록과 운영시간을 값 바깥에 넣어 보내도 저장되지 않는다", async () => {
  const server = await draftServer();
  await submitApplication(send(formPayload({ adminReview: { status: "approved", note: "조작" }, studioHours: { days: [] }, extra: 1 })), server.as(owner));
  assert.deepEqual(Object.keys(await stored(server)).sort(), ["categories", "experiences", "values", "works"]);
});

test("조작한 신청서가 승인돼도 운영자가 켜기 전에는 공개되지 않는다", async () => {
  const server = await draftServer();
  await submitApplication(send(formPayload({ values: formValues(OPERATOR_VALUES) })), server.as(owner));
  const approve = new Request("https://site.test", { method: "PATCH", body: JSON.stringify({ status: "approved" }) });
  assert.equal((await updateApplicationStatus(approve, ID, server.as(user("boss", "admin")))).status, 200);

  const { values } = await stored(server);
  assert.equal(values.mapPublished, false);
  assert.equal(await findPublicArtist(server.DB as never, ID), null);
});

test("글자가 아닌 값은 저장하지 않고, 정해진 길이를 넘으면 자른다", async () => {
  const server = await draftServer();
  const values = formValues({ bio: "가".repeat(5000), tagline: { html: "<script>" }, hours: ["월요일"], feedback: 123 });
  assert.equal((await submitApplication(send(formPayload({ values })), server.as(owner))).status, 201);
  const saved = (await stored(server)).values;
  assert.equal(saved.bio.length, 4000);
  assert.equal(saved.tagline, "");
  assert.equal(saved.hours, "");
  assert.equal(saved.feedback, "");
});

test("동의는 체크 값이어야 하고, 옛 동의 문구로 보낸 신청은 받지 않는다", async () => {
  for (const consent of [{ consentInfo: false }, { consentImage: "yes" }, { consentPrivacy: 1 }, { consentVersion: "2020-01-01" }]) {
    const server = await draftServer();
    const response = await submitApplication(send(formPayload({ values: formValues(consent) })), server.as(owner));
    assert.equal(response.status, 400, JSON.stringify(consent));
    assert.equal((await server.application(ID))!.status, "draft");
  }
});

test("필수 항목이 빠지면 받지 않고 초안을 그대로 둔다", async () => {
  for (const overrides of [
    { values: formValues({ artistName: " " }) },
    { values: formValues({ phone: "" }) },
    { categories: [] },
    { works: [] },
    { works: Array.from({ length: 5 }, () => ({ title: "" })) },
    { experiences: "체험" },
    { experiences: [{ title: "" }] },
  ]) {
    const server = await draftServer();
    assert.equal((await submitApplication(send(formPayload(overrides)), server.as(owner))).status, 400, JSON.stringify(overrides));
    assert.equal((await server.application(ID))!.status, "draft");
  }
});

test("형식이 깨진 요청은 400으로 거절하고 아무것도 바꾸지 않는다", async () => {
  const server = await draftServer();
  const before = server.BUCKET.keys();
  for (const body of [
    "{깨진 JSON",
    "null",
    "[]",
    "\"문자열\"",
    formPayload({ values: "값" }),
    formPayload({ works: [null, null, null, null, null] }),
    formPayload({ uploadedImages: [null] }),
    formPayload({ expectedImages: { works: "많음" } }),
  ]) {
    const response = await submitApplication(send(typeof body === "string" ? body : JSON.stringify(body)), server.as(owner));
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal(typeof (await response.json() as { error?: unknown }).error, "string");
  }
  assert.equal((await server.application(ID))!.status, "draft");
  assert.deepEqual(server.BUCKET.keys(), before);
});

test("payload가 없거나 너무 크면 받지 않는다", async () => {
  const server = await draftServer();
  const empty = new Request("https://site.test/api/applications", { method: "POST", body: new FormData() });
  assert.equal((await submitApplication(empty, server.as(owner))).status, 400);
  assert.equal((await submitApplication(send("가".repeat(150_001)), server.as(owner))).status, 400);
});

test("다른 사람의 초안에는 제출할 수 없고 그 사람의 신청서와 이미지는 그대로다", async () => {
  const server = await draftServer();
  const before = await server.application(ID);
  const keys = server.BUCKET.keys();
  assert.equal((await submitApplication(send(formPayload()), server.as(user("stranger")))).status, 403);
  assert.deepEqual(await server.application(ID), before);
  assert.deepEqual(server.BUCKET.keys(), keys);
});

test("이미 제출된 신청서는 다시 제출해 덮어쓸 수 없다", async () => {
  const server = await draftServer();
  await submitApplication(send(formPayload()), server.as(owner));
  const before = await server.application(ID);
  const again = formPayload({ values: formValues({ artistName: "바꾼 이름" }) });
  assert.equal((await submitApplication(send(again), server.as(owner))).status, 403);
  assert.deepEqual(await server.application(ID), before);
});

test("다른 신청서의 이미지를 끌어다 쓸 수 없고 그 이미지는 지워지지 않는다", async () => {
  const server = await draftServer();
  await server.addApplication(OTHER_ID, { accountId: "other", status: "received" });
  await putImage(server, workKey(0, OTHER_ID), OTHER_ID);
  // 경로만 내 신청서처럼 꾸민 경우: 저장 정보의 신청서 번호가 달라 거절됩니다.
  await putImage(server, `applications/${ID}/stolen.webp`, OTHER_ID);

  await putImage(server, "work-guides/WG-1/image.webp");

  for (const key of [workKey(0, OTHER_ID), `applications/${ID}/stolen.webp`, "work-guides/WG-1/image.webp"]) {
    const images = uploadedImages();
    images[1] = { ...images[1], key };
    const response = await submitApplication(send(formPayload({ uploadedImages: images })), server.as(owner));
    assert.equal(response.status, 400, key);
    assert.equal((await server.application(ID))!.status, "draft");
  }
  assert.ok(server.BUCKET.keys().includes(workKey(0, OTHER_ID)));
});

test("같은 자리에 이미지를 두 번 넣으면 받지 않는다", async () => {
  const server = await draftServer();
  const images = uploadedImages();
  images[2] = { ...images[2], workIndex: 0 };
  const response = await submitApplication(send(formPayload({ uploadedImages: images })), server.as(owner));
  assert.equal(response.status, 400);
  assert.match((await response.json() as { error: string }).error, /중복/);
  assert.equal((await server.application(ID))!.status, "draft");
});

test("이미 올린 자리에 사진을 또 담아 보내면 받지 않고 방금 올린 것을 남기지 않는다", async () => {
  const server = await draftServer();
  const before = server.BUCKET.keys();
  const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], "내 사진.png", { type: "image/png" });
  const response = await submitApplication(send(formPayload(), { profileImage: file }), server.as(owner));
  assert.equal(response.status, 400);
  assert.match((await response.json() as { error: string }).error, /중복/);
  assert.deepEqual(server.BUCKET.keys(), before);
});

test("작품은 5점까지만 저장하고 체험은 20개를 넘으면 받지 않는다", async () => {
  const works = Array.from({ length: 6 }, (_, index) => ({ id: `w${index}`, title: `작품 ${index}`, status: "문의 필요", description: "" }));
  const accepted = await draftServer();
  assert.equal((await submitApplication(send(formPayload({ works })), accepted.as(owner))).status, 201);
  assert.equal((await stored(accepted)).works.length, 5);

  const experiences = Array.from({ length: 21 }, (_, index) => ({ id: `e${index}`, title: "체험", status: "운영 중", description: "" }));
  const rejected = await draftServer();
  assert.equal((await submitApplication(send(formPayload({ experiences })), rejected.as(owner))).status, 400);
});

test("작품 이미지가 5점이 아니면 받지 않는다", async () => {
  const server = await draftServer();
  const payload = formPayload({ uploadedImages: uploadedImages().slice(0, 5), expectedImages: { profile: true, works: [true, true, true, true, false] } });
  assert.equal((await submitApplication(send(payload), server.as(owner))).status, 400);
  assert.equal((await server.application(ID))!.status, "draft");
});

test("제출 뒤 신청서에 기록되지 않은 사진은 지우고 기록된 사진과 다른 신청서의 사진은 남긴다", async () => {
  const server = await draftServer();
  await putImage(server, `applications/${ID}/replaced.webp`);
  await putImage(server, workKey(0, OTHER_ID), OTHER_ID);
  assert.equal((await submitApplication(send(formPayload()), server.as(owner))).status, 201);
  const keys = server.BUCKET.keys();
  assert.equal(keys.includes(`applications/${ID}/replaced.webp`), false);
  assert.ok(keys.includes(profileKey));
  assert.ok(keys.includes(workKey(4)));
  assert.ok(keys.includes(workKey(0, OTHER_ID)));
});

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

test("요청에 직접 담은 사진도 형식을 확인해 저장하고, 접수가 거절되면 방금 올린 것을 지운다", async () => {
  const server = await draftServer();
  const accepted = uploadedImages().filter((image) => image.type === "work");
  const file = new File([PNG], "내 사진.png", { type: "image/png" });
  const ok = formPayload({ uploadedImages: accepted });
  assert.equal((await submitApplication(send(ok, { profileImage: file }), server.as(owner))).status, 201);
  const profile = JSON.parse((await server.application(ID))!.image_keys_json).find((image: { type: string }) => image.type === "profile");
  assert.match(profile.key, new RegExp(`^applications/${ID}/[0-9a-f-]+\\.png$`));
  assert.ok(server.BUCKET.keys().includes(profile.key));

  const rejected = await draftServer();
  const before = rejected.BUCKET.keys();
  const missing = formPayload({ uploadedImages: accepted.slice(1), expectedImages: { profile: true, works: [false, true, true, true, true] } });
  assert.equal((await submitApplication(send(missing, { profileImage: file }), rejected.as(owner))).status, 400);
  assert.deepEqual(rejected.BUCKET.keys(), before);

  const fake = await draftServer();
  const notImage = new File(["텍스트"], "가짜.png", { type: "image/png" });
  assert.equal((await submitApplication(send(formPayload({ uploadedImages: accepted }), { profileImage: notImage }), fake.as(owner))).status, 400);
});

test("저장 도중 오류가 나면 방금 올린 사진을 지우고 500을 돌려준다", async (t) => {
  const server = await draftServer();
  t.mock.method(console, "error", () => {});
  const context = server.as(owner);
  const before = server.BUCKET.keys();
  const prepare = context.DB.prepare.bind(context.DB);
  t.mock.method(context.DB, "prepare", (sql: string) => {
    if (sql.startsWith("UPDATE artist_applications")) throw new Error("DB 멈춤");
    return prepare(sql);
  });
  const file = new File([PNG], "내 사진.png", { type: "image/png" });
  const payload = formPayload({ uploadedImages: uploadedImages().filter((image) => image.type === "work") });
  assert.equal((await submitApplication(send(payload, { profileImage: file }), context)).status, 500);
  assert.deepEqual(server.BUCKET.keys(), before);
  t.mock.restoreAll();
  assert.equal((await server.application(ID))!.status, "draft");
});

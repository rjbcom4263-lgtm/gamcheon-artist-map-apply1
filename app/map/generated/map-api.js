// 자동 생성 파일입니다. 고치지 말고 art-map 저장소의 server/를 고친 뒤 npm run export:site로 다시 만드세요.
// Bundled from https://github.com/InSeok211/art-map at 78404fc + uncommitted changes.

// server/http.ts
var json = (body, init = {}) => Response.json(body, { ...init, headers: { "cache-control": "no-store", ...init.headers } });
var error = (message, status) => json({ error: message }, { status });
async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}
function fromThisApp(request, url) {
  if (request.method === "GET" || request.method === "HEAD") return true;
  return request.headers.get("origin") === url.origin;
}

// server/alleys.ts
var WORK_AREA = { west: 129.006, south: 35.09274, east: 129.0135, north: 35.0992 };
var MAX_ALLEYS = 500;
var MAX_LINE_POINTS = 500;
var MAX_TRAIL_POINTS = 1e4;
var insideWorkArea = (lng, lat) => lng >= WORK_AREA.west && lng <= WORK_AREA.east && lat >= WORK_AREA.south && lat <= WORK_AREA.north;
var round7 = (value) => Math.round(value * 1e7) / 1e7;
function cleanLine(value) {
  if (!Array.isArray(value) || value.length < 2 || value.length > MAX_LINE_POINTS) return null;
  const line = [];
  for (const point of value) {
    if (!Array.isArray(point) || point.length !== 2 || !point.every((part) => typeof part === "number" && Number.isFinite(part))) return null;
    if (!insideWorkArea(point[0], point[1])) return null;
    line.push([round7(point[0]), round7(point[1])]);
  }
  return line;
}
function cleanAlleys(value) {
  if (!Array.isArray(value) || value.length > MAX_ALLEYS) return null;
  const alleys = [];
  for (const item of value) {
    const alley = item;
    if (!alley || typeof alley.id !== "string" || !alley.id || alley.id.length > 80) return null;
    if (alley.name !== void 0 && (typeof alley.name !== "string" || alley.name.length > 60)) return null;
    const width = Number(alley.widthMeters);
    if (!Number.isFinite(width) || width < 1 || width > 8) return null;
    const coordinates = cleanLine(alley.coordinates);
    if (!coordinates) return null;
    alleys.push({ id: alley.id, ...alley.name ? { name: alley.name } : {}, coordinates, widthMeters: width });
  }
  return alleys;
}
function cleanLines(value) {
  if (!Array.isArray(value) || value.length > MAX_ALLEYS) return null;
  const lines = [];
  for (const item of value) {
    const line = cleanLine(item);
    if (!line) return null;
    lines.push(line);
  }
  return lines;
}
async function readAlleys(env) {
  const row = await env.DB.prepare("SELECT alleys_json, dismissed_json, updated_at FROM map_alleys WHERE id = 'active'").first();
  return {
    alleys: row ? cleanAlleys(JSON.parse(row.alleys_json)) ?? [] : [],
    dismissed: row ? cleanLines(JSON.parse(row.dismissed_json)) ?? [] : [],
    updatedAt: row?.updated_at ?? null
  };
}
async function publicAlleys(env) {
  const { alleys, updatedAt } = await readAlleys(env);
  return json({ alleys, updatedAt }, { headers: { "cache-control": "public, max-age=60" } });
}
var adminAlleys = async (env) => json(await readAlleys(env));
async function saveAlleys(request, env) {
  const body = await readJson(request);
  const alleys = cleanAlleys(body?.alleys);
  const dismissed = cleanLines(body?.dismissed ?? []);
  if (!alleys || !dismissed) return error("\uACE8\uBAA9\uAE38\uC740 \uAC10\uCC9C \uC791\uC5C5 \uBC94\uC704 \uC548\uC5D0\uC11C 2~500\uAC1C \uC810, \uD3ED 1~8m\uB85C \uC9C0\uC815\uD574\uC8FC\uC138\uC694.", 400);
  await env.DB.prepare(`INSERT INTO map_alleys (id, alleys_json, dismissed_json, updated_at) VALUES ('active', ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET alleys_json = excluded.alleys_json, dismissed_json = excluded.dismissed_json, updated_at = CURRENT_TIMESTAMP`).bind(JSON.stringify(alleys), JSON.stringify(dismissed)).run();
  return json({ alleys, dismissed });
}
async function listTrails(env) {
  const { results } = await env.DB.prepare("SELECT id, started_at, points_json FROM gps_trails ORDER BY started_at").all();
  return json({ trails: results.map((row) => ({ id: row.id, startedAt: row.started_at, points: JSON.parse(row.points_json) })) });
}
async function saveTrail(request, env) {
  const body = await readJson(request);
  if (!body || typeof body.id !== "string" || !body.id || body.id.length > 80 || typeof body.startedAt !== "string" || Number.isNaN(Date.parse(body.startedAt)) || !Array.isArray(body.points) || body.points.length > MAX_TRAIL_POINTS) {
    return error(`\uAE30\uB85D \uD615\uC2DD\uC774 \uB9DE\uC9C0 \uC54A\uAC70\uB098 \uB108\uBB34 \uAE41\uB2C8\uB2E4(\uCD5C\uB300 ${MAX_TRAIL_POINTS}\uC810).`, 400);
  }
  const kept = body.points.flatMap((point) => {
    if (!Array.isArray(point) || point.length !== 4 || !point.every((part) => typeof part === "number" && Number.isFinite(part))) return [];
    const [lng, lat, accuracy, time] = point;
    return insideWorkArea(lng, lat) ? [[round7(lng), round7(lat), Math.round(accuracy * 10) / 10, Math.round(time)]] : [];
  });
  if (kept.length < 5) return error("\uAC10\uCC9C \uC791\uC5C5 \uBC94\uC704 \uC548\uC5D0\uC11C \uAE30\uB85D\uD55C \uC704\uCE58\uAC00 \uB108\uBB34 \uC801\uC2B5\uB2C8\uB2E4.", 400);
  const first = Math.min(...kept.map((point) => point[3]));
  const points2 = kept.map(([lng, lat, accuracy, time]) => [lng, lat, accuracy, time - first]);
  const startedAt = new Date(body.startedAt).toISOString().slice(0, 10);
  await env.DB.prepare(`INSERT INTO gps_trails (id, started_at, points_json) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET points_json = excluded.points_json`).bind(body.id, startedAt, JSON.stringify(points2)).run();
  return json({ trail: { id: body.id, startedAt, points: points2 } });
}
async function deleteTrail(url, env) {
  const id = url.searchParams.get("id");
  if (!id) return error("\uC9C0\uC6B8 \uAE30\uB85D\uC744 \uC54C\uB824\uC8FC\uC138\uC694.", 400);
  await env.DB.prepare("DELETE FROM gps_trails WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

// src/data/gamcheon2-boundary.json
var gamcheon2_boundary_default = {
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [
          129.0028058,
          35.0964163
        ],
        [
          129.0047562,
          35.0936664
        ],
        [
          129.0048037,
          35.0929903
        ],
        [
          129.0046232,
          35.0924153
        ],
        [
          129.0041312,
          35.0918637
        ],
        [
          129.0035829,
          35.0913356
        ],
        [
          129.0034619,
          35.0910598
        ],
        [
          129.0035972,
          35.0907081
        ],
        [
          129.00411,
          35.0902341
        ],
        [
          129.0042857,
          35.0903895
        ],
        [
          129.0047226,
          35.0903662
        ],
        [
          129.0049244,
          35.0901836
        ],
        [
          129.0052853,
          35.0900029
        ],
        [
          129.0056557,
          35.0897212
        ],
        [
          129.0059834,
          35.0900398
        ],
        [
          129.0062517,
          35.090304
        ],
        [
          129.0064226,
          35.0901603
        ],
        [
          129.0066149,
          35.0897542
        ],
        [
          129.0069378,
          35.0898008
        ],
        [
          129.0073035,
          35.08976
        ],
        [
          129.0077689,
          35.0893967
        ],
        [
          129.0086284,
          35.0894453
        ],
        [
          129.0088753,
          35.0892957
        ],
        [
          129.0101129,
          35.089304
        ],
        [
          129.0107106,
          35.0894826
        ],
        [
          129.014124,
          35.0893494
        ],
        [
          129.013826,
          35.0899963
        ],
        [
          129.0138017,
          35.0903497
        ],
        [
          129.0139477,
          35.0906433
        ],
        [
          129.0143187,
          35.0911757
        ],
        [
          129.0142457,
          35.0917679
        ],
        [
          129.0143734,
          35.0927383
        ],
        [
          129.0143734,
          35.0931762
        ],
        [
          129.0142153,
          35.0937435
        ],
        [
          129.0137208,
          35.094346
        ],
        [
          129.0136436,
          35.0944402
        ],
        [
          129.0134246,
          35.0950572
        ],
        [
          129.0129016,
          35.095729
        ],
        [
          129.0125549,
          35.0960972
        ],
        [
          129.0115149,
          35.0966197
        ],
        [
          129.0111865,
          35.0969581
        ],
        [
          129.0107365,
          35.0978438
        ],
        [
          129.0101587,
          35.0994262
        ],
        [
          129.0098668,
          35.0996202
        ],
        [
          129.0079388,
          35.0997347
        ],
        [
          129.0071907,
          35.0996551
        ],
        [
          129.0070281,
          35.0994011
        ],
        [
          129.0061714,
          35.0983851
        ],
        [
          129.005332,
          35.097731
        ],
        [
          129.0028058,
          35.0964163
        ]
      ]
    ]
  },
  type: "Feature",
  properties: {
    source: "OpenStreetMap",
    name: "\uAC10\uCC9C2\uB3D9",
    osm_relation: 4057099
  }
};

// src/map/gamcheonBoundary.ts
var ring = gamcheon2_boundary_default.geometry.coordinates[0].map(
  ([longitude, latitude]) => [longitude, latitude]
);
var longitudes = ring.map(([longitude]) => longitude);
var latitudes = ring.map(([, latitude]) => latitude);
var GAMCHEON2_BOUNDS = [
  [Math.min(...longitudes), Math.min(...latitudes)],
  [Math.max(...longitudes), Math.max(...latitudes)]
];
var GAMCHEON_MAP_BOUNDS = [
  [GAMCHEON2_BOUNDS[0][0] - 3e-3, GAMCHEON2_BOUNDS[0][1] - 25e-4],
  [GAMCHEON2_BOUNDS[1][0] + 3e-3, GAMCHEON2_BOUNDS[1][1] + 25e-4]
];
var [[west, south], [east, north]] = GAMCHEON_MAP_BOUNDS;
var mapAreaRing = [[west, south], [east, south], [east, north], [west, north], [west, south]];
var gamcheonOutsideFeature = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [
      [[128.5, 34.7], [129.5, 34.7], [129.5, 35.5], [128.5, 35.5], [128.5, 34.7]],
      [...mapAreaRing].reverse()
    ]
  }
};
function isInsideGamcheonMap(longitude, latitude) {
  return Number.isFinite(longitude) && Number.isFinite(latitude) && longitude >= west && longitude <= east && latitude >= south && latitude <= north;
}

// src/map/streetCoordinates.ts
var STREET_ORIGIN = [129.0089, 35.0949];
var METERS_PER_DEGREE_LAT = 111320;
var METERS_PER_DEGREE_LON = METERS_PER_DEGREE_LAT * Math.cos(STREET_ORIGIN[1] * Math.PI / 180);

// src/buildings/buildingSettings.ts
function sanitizeBuildingSettings(value) {
  if (!value || typeof value !== "object") return {};
  const input = value, result = {};
  if (typeof input.name === "string" && input.name.trim()) result.name = input.name.trim().slice(0, 120);
  const number = (value2, min, max) => typeof value2 === "number" && Number.isFinite(value2) ? Math.max(min, Math.min(max, value2)) : void 0;
  const flat = number(input.flatBaseMeters, -50, 50);
  if (flat !== void 0) result.flatBaseMeters = flat;
  const placement = input.placement;
  if (placement && typeof placement.longitude === "number" && typeof placement.latitude === "number" && isInsideGamcheonMap(placement.longitude, placement.latitude) && number(placement.rotation, -36e3, 36e3) !== void 0 && number(placement.scale, 0.1, 5) !== void 0) {
    result.placement = {
      longitude: placement.longitude,
      latitude: placement.latitude,
      rotation: (placement.rotation % 360 + 360) % 360,
      scale: Math.max(0.1, Math.min(5, placement.scale))
    };
  }
  const terrain = input.terrain;
  if (terrain && typeof terrain === "object") {
    const clean = {};
    const offset = number(terrain.offsetMeters, -50, 50), base = number(terrain.baseElevationMeters, 0, 1e3);
    if (offset !== void 0) clean.offsetMeters = offset;
    if (base !== void 0) clean.baseElevationMeters = base;
    if (Array.isArray(terrain.entrance) && terrain.entrance.length === 2 && terrain.entrance.every(Number.isFinite) && isInsideGamcheonMap(terrain.entrance[0], terrain.entrance[1])) clean.entrance = [...terrain.entrance];
    if (typeof terrain.foundation === "boolean") clean.foundation = terrain.foundation;
    if (Object.keys(clean).length) result.terrain = clean;
  }
  return result;
}

// src/buildings/buildingEdits.ts
var EMPTY_BUILDING_EDITS = { overrides: {}, added: [], models: [] };
var MODEL_WIDTH_RANGE = { min: 1, max: 120 };
var MODEL_FILE_ID = /^m-[a-z0-9]{8,40}$/;
var PHOTO_FILE_ID = /^i-[a-z0-9]{8,40}$/;
var WORKSHOP_TEXT_LIMITS = { name: 60, address: 160, description: 500 };
var MAX_PREVIEW_PHOTO = 7e5;
var ADDED_OUTLINE_POINTS = { min: 3, max: 60 };
var BUILDING_HEIGHT_RANGE = { min: 2.5, max: 60 };
var MAX_OVERRIDES = 3e3;
var MAX_ADDED = 500;
var MAX_MODELS = 100;
var MAX_REPLACES = 20;
var isColor = (value) => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 16777215;
function sanitizeOverride(value) {
  if (!value || typeof value !== "object") return null;
  const input = value;
  const override = sanitizeBuildingSettings(input);
  if (input.hidden === true) override.hidden = true;
  const height = Number(input.heightMeters);
  if (input.heightMeters !== void 0 && Number.isFinite(height)) {
    override.heightMeters = Math.min(BUILDING_HEIGHT_RANGE.max, Math.max(BUILDING_HEIGHT_RANGE.min, height));
  }
  if (isColor(input.wallColor)) override.wallColor = input.wallColor;
  if (isColor(input.roofColor)) override.roofColor = input.roofColor;
  if (input.roofStyle === "flat" || input.roofStyle === "gable") override.roofStyle = input.roofStyle;
  return Object.keys(override).length ? override : null;
}
function sanitizeAdded(value) {
  if (!value || typeof value !== "object") return null;
  const input = value;
  if (typeof input.id !== "string" || !/^[\w-]{1,80}$/.test(input.id) || !Array.isArray(input.outline)) return null;
  const outline = input.outline.filter((point) => Array.isArray(point) && point.length === 2 && point.every((part) => Number.isFinite(part)) && isInsideGamcheonMap(point[0], point[1]));
  if (outline.length !== input.outline.length || outline.length < ADDED_OUTLINE_POINTS.min || outline.length > ADDED_OUTLINE_POINTS.max) return null;
  const height = Number(input.heightMeters);
  if (!Number.isFinite(height) || !isColor(input.wallColor) || !isColor(input.roofColor)) return null;
  if (input.roofStyle !== "flat" && input.roofStyle !== "gable") return null;
  return {
    ...sanitizeBuildingSettings(input),
    id: input.id,
    outline: outline.map(([lng, lat]) => [Math.round(lng * 1e7) / 1e7, Math.round(lat * 1e7) / 1e7]),
    heightMeters: Math.min(BUILDING_HEIGHT_RANGE.max, Math.max(BUILDING_HEIGHT_RANGE.min, height)),
    wallColor: input.wallColor,
    roofColor: input.roofColor,
    roofStyle: input.roofStyle
  };
}
function sanitizeModel(value) {
  if (!value || typeof value !== "object") return null;
  const input = value;
  if (typeof input.id !== "string" || !/^[\w-]{1,80}$/.test(input.id)) return null;
  if (typeof input.modelId !== "string" || !MODEL_FILE_ID.test(input.modelId)) return null;
  const longitude = Number(input.longitude), latitude = Number(input.latitude);
  if (!isInsideGamcheonMap(longitude, latitude)) return null;
  const rotation = Number(input.rotation), width = Number(input.widthMeters);
  if (!Number.isFinite(rotation) || !Number.isFinite(width)) return null;
  const replaces = Array.isArray(input.replaces) ? [...new Set(input.replaces.filter((id) => Number.isSafeInteger(id) && Number(id) > 0))].slice(0, MAX_REPLACES) : [];
  return {
    ...sanitizeBuildingSettings(input),
    id: input.id,
    modelId: input.modelId,
    name: typeof input.name === "string" ? input.name.slice(0, 80) : "",
    longitude: Math.round(longitude * 1e7) / 1e7,
    latitude: Math.round(latitude * 1e7) / 1e7,
    rotation: Math.round((rotation % 360 + 360) % 360 * 10) / 10 % 360,
    widthMeters: Math.round(Math.min(MODEL_WIDTH_RANGE.max, Math.max(MODEL_WIDTH_RANGE.min, width)) * 10) / 10,
    replaces
  };
}
function sanitizeBuildingEdits(value) {
  const overrides = {};
  const input = value?.overrides;
  if (input && typeof input === "object") {
    for (const [id, raw] of Object.entries(input).slice(0, MAX_OVERRIDES)) {
      if (!/^\d+$/.test(id)) continue;
      const override = sanitizeOverride(raw);
      if (override) overrides[id] = override;
    }
  }
  const addedInput = value?.added;
  const added = Array.isArray(addedInput) ? addedInput.slice(0, MAX_ADDED).flatMap((item) => sanitizeAdded(item) ?? []) : [];
  const modelInput = value?.models;
  const models = Array.isArray(modelInput) ? modelInput.slice(0, MAX_MODELS).flatMap((item) => sanitizeModel(item) ?? []) : [];
  const workshop = sanitizeWorkshopInfo(value?.workshop);
  return workshop ? { overrides, added, models, workshop } : { overrides, added, models };
}
function sanitizeWorkshopInfo(value) {
  if (!value || typeof value !== "object") return null;
  const input = value;
  const info = {};
  for (const key of ["name", "address", "description"]) {
    const text = typeof input[key] === "string" ? input[key].trim().slice(0, WORKSHOP_TEXT_LIMITS[key]) : "";
    if (text) info[key] = text;
  }
  const photo = input.photo;
  if (typeof photo === "string" && (PHOTO_FILE_ID.test(photo) || photo.startsWith("data:image/jpeg;base64,") && photo.length <= MAX_PREVIEW_PHOTO && /^[A-Za-z0-9+/=]+$/.test(photo.slice(23)))) {
    info.photo = photo;
  }
  return Object.keys(info).length ? info : null;
}

// server/images.ts
var PREFIX = "map-images/";
var MAX_PHOTO_BYTES = 2 * 1024 * 1024;
var photoKey = (id) => `${PREFIX}${id}`;
var newPhotoId = () => `i-${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
function photoType(bytes) {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) return "image/png";
  const text = (start, end) => String.fromCharCode(...bytes.slice(start, end));
  if (text(0, 4) === "RIFF" && text(8, 12) === "WEBP") return "image/webp";
  return null;
}
async function uploadPhoto(request, env) {
  if (Number(request.headers.get("content-length") || 0) > MAX_PHOTO_BYTES + 64 * 1024) return error("\uC0AC\uC9C4\uC774 \uB108\uBB34 \uD07D\uB2C8\uB2E4(\uCD5C\uB300 2MB).", 413);
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string" || !file.size) return error("\uC0AC\uC9C4 \uD30C\uC77C\uC744 \uACE8\uB77C \uC8FC\uC138\uC694.", 400);
  if (file.size > MAX_PHOTO_BYTES) return error("\uC0AC\uC9C4\uC774 \uB108\uBB34 \uD07D\uB2C8\uB2E4(\uCD5C\uB300 2MB).", 413);
  const buffer = await file.arrayBuffer();
  const type = photoType(new Uint8Array(buffer, 0, Math.min(16, buffer.byteLength)));
  if (!type) return error("JPEG\xB7PNG\xB7WebP \uC0AC\uC9C4\uB9CC \uC62C\uB9B4 \uC218 \uC788\uC2B5\uB2C8\uB2E4.", 400);
  const id = newPhotoId();
  await env.MODELS.put(photoKey(id), buffer, { httpMetadata: { contentType: type } });
  return json({ photo: id });
}
async function deletePhoto(id, env) {
  if (!PHOTO_FILE_ID.test(id)) return error("\uC0AC\uC9C4 \uBC88\uD638\uAC00 \uB9DE\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.", 400);
  const { draft, published } = await readBothVersions(env);
  if (published.workshop?.photo === id) return error("\uACF5\uAC1C \uC9C0\uB3C4\uC5D0 \uB454 \uC0AC\uC9C4\uC785\uB2C8\uB2E4. \uB2E4\uB978 \uC0AC\uC9C4\uC73C\uB85C \uBC14\uAFD4 \uACF5\uAC1C\uD55C \uB4A4 \uC9C0\uC6CC \uC8FC\uC138\uC694.", 409);
  if (draft.workshop?.photo === id) return error("\uCD08\uC548\uC5D0 \uB454 \uC0AC\uC9C4\uC785\uB2C8\uB2E4. \uBA3C\uC800 \uB2E4\uB978 \uC0AC\uC9C4\uC73C\uB85C \uBC14\uAFD4 \uC8FC\uC138\uC694.", 409);
  await env.MODELS.delete(photoKey(id));
  return json({ ok: true });
}
async function deleteUnusedPhotos(env) {
  if (typeof env.MODELS.list !== "function") return 0;
  const { draft, published } = await readBothVersions(env);
  const keep = new Set([draft.workshop?.photo, published.workshop?.photo].filter((photo) => !!photo));
  const unused = [];
  let cursor;
  do {
    const page = await env.MODELS.list({ prefix: PREFIX, cursor });
    for (const object of page.objects) if (!keep.has(object.key.slice(PREFIX.length))) unused.push(object.key);
    cursor = page.truncated ? page.cursor : void 0;
  } while (cursor);
  if (unused.length) await env.MODELS.delete(unused);
  return unused.length;
}
async function getPhoto(id, request, env) {
  if (!PHOTO_FILE_ID.test(id)) return new Response("Not found", { status: 404 });
  const published = (await readPublished(env)).workshop?.photo === id;
  if (!published && !await env.isAdmin(request)) return new Response("Not found", { status: 404 });
  const object = await env.MODELS.get(photoKey(id));
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "image/jpeg",
      "cache-control": published ? "public, max-age=3600" : "private, no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

// server/buildings.ts
async function cleanupPhotos(env) {
  try {
    await deleteUnusedPhotos(env);
  } catch (cause) {
    console.error("unused photo cleanup failed", cause);
  }
}
async function read(env, id) {
  const row = await env.DB.prepare("SELECT edits_json, updated_at FROM map_building_edits WHERE id = ?").bind(id).first();
  return { edits: row ? sanitizeBuildingEdits(JSON.parse(row.edits_json)) : EMPTY_BUILDING_EDITS, updatedAt: row?.updated_at ?? null, exists: Boolean(row) };
}
async function write(env, id, edits) {
  await env.DB.prepare(`INSERT INTO map_building_edits (id, edits_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET edits_json = excluded.edits_json, updated_at = CURRENT_TIMESTAMP`).bind(id, JSON.stringify(edits)).run();
}
async function readBothVersions(env) {
  const [draft, published] = await Promise.all([read(env, "draft"), read(env, "published")]);
  return { draft: draft.exists ? draft.edits : published.edits, published: published.edits, draftUpdatedAt: draft.updatedAt, publishedAt: published.updatedAt };
}
var readPublished = async (env) => (await read(env, "published")).edits;
async function publicBuildings(env) {
  const published = await read(env, "published");
  return json({ edits: published.edits, publishedAt: published.updatedAt });
}
var adminBuildings = async (env) => json(await readBothVersions(env));
async function saveDraft(request, env) {
  const body = await readJson(request);
  const input = body?.draft;
  if (!input || typeof input.overrides !== "object" || !input.overrides || Array.isArray(input.overrides) || !Array.isArray(input.added) || !Array.isArray(input.models)) {
    return error("\uAC74\uBB3C \uCD08\uC548 \uD615\uC2DD\uC774 \uC798\uBABB\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uAE30\uC874 \uCD08\uC548\uC740 \uC720\uC9C0\uB429\uB2C8\uB2E4.", 400);
  }
  const draft = sanitizeBuildingEdits(input);
  if (Object.keys(draft.overrides).length !== Object.keys(input.overrides).length || draft.added.length !== input.added.length || draft.models.length !== input.models.length || new Set(draft.added.map((building) => building.id)).size !== draft.added.length || new Set(draft.models.map((model) => model.id)).size !== draft.models.length) {
    return error("\uC800\uC7A5\uD560 \uC218 \uC5C6\uB294 \uAC74\uBB3C \uB370\uC774\uD130\uB098 \uC911\uBCF5 ID\uAC00 \uC788\uC2B5\uB2C8\uB2E4. \uAE30\uC874 \uCD08\uC548\uC740 \uC720\uC9C0\uB429\uB2C8\uB2E4.", 400);
  }
  if (draft.workshop?.photo?.startsWith("data:")) return error("\uACF5\uBC29 \uC0AC\uC9C4\uC740 \uC11C\uBC84\uC5D0 \uC62C\uB9B0 \uB4A4 \uC800\uC7A5\uD574 \uC8FC\uC138\uC694. \uAE30\uC874 \uCD08\uC548\uC740 \uC720\uC9C0\uB429\uB2C8\uB2E4.", 400);
  await write(env, "draft", draft);
  await cleanupPhotos(env);
  return json({ draft });
}
async function publish(env) {
  const { draft } = await readBothVersions(env);
  await write(env, "published", draft);
  await cleanupPhotos(env);
  return json({ published: draft });
}
async function discard(env) {
  const published = await readPublished(env);
  await write(env, "draft", published);
  await cleanupPhotos(env);
  return json({ draft: published });
}

// src/buildings/glbCheck.ts
var MAX_GLB_BYTES = 20 * 1024 * 1024;
var UNSUPPORTED_EXTENSIONS = ["KHR_draco_mesh_compression", "EXT_meshopt_compression", "KHR_texture_basisu"];
function checkGlb(buffer) {
  if (buffer.byteLength > MAX_GLB_BYTES) return `\uD30C\uC77C\uC774 \uB108\uBB34 \uD07D\uB2C8\uB2E4(\uCD5C\uB300 ${MAX_GLB_BYTES / 1024 / 1024}MB).`;
  if (buffer.byteLength < 20) return "GLB \uD30C\uC77C\uC774 \uC544\uB2D9\uB2C8\uB2E4.";
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 1179937895) return "GLB \uD30C\uC77C\uC774 \uC544\uB2D9\uB2C8\uB2E4(.gltf\uB294 \uD14D\uC2A4\uCC98\uB97C \uBB36\uC740 .glb\uB85C \uB0B4\uBCF4\uB0B4 \uC8FC\uC138\uC694).";
  if (view.getUint32(4, true) !== 2) return "glTF 2.0 \uD615\uC2DD\uC758 GLB\uB9CC \uC62C\uB9B4 \uC218 \uC788\uC2B5\uB2C8\uB2E4.";
  if (view.getUint32(8, true) !== buffer.byteLength) return "GLB \uD30C\uC77C\uC774 \uC190\uC0C1\uB418\uC5C8\uC2B5\uB2C8\uB2E4.";
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 1313821514 || 20 + jsonLength > buffer.byteLength) return "GLB \uD30C\uC77C\uC774 \uC190\uC0C1\uB418\uC5C8\uC2B5\uB2C8\uB2E4.";
  let json2;
  try {
    json2 = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)));
  } catch {
    return "GLB \uD30C\uC77C\uC774 \uC190\uC0C1\uB418\uC5C8\uC2B5\uB2C8\uB2E4.";
  }
  const external = [...json2.buffers ?? [], ...json2.images ?? []].some((item) => typeof item?.uri === "string" && !item.uri.startsWith("data:"));
  if (external) return "\uB2E4\uB978 \uD30C\uC77C\uC744 \uBD88\uB7EC\uC624\uB294 GLB\uB294 \uC62C\uB9B4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uD14D\uC2A4\uCC98\uB97C \uD3EC\uD568\uD574 \uD558\uB098\uC758 .glb\uB85C \uB0B4\uBCF4\uB0B4 \uC8FC\uC138\uC694.";
  const required = Array.isArray(json2.extensionsRequired) ? json2.extensionsRequired : [];
  const unsupported = required.find((name) => UNSUPPORTED_EXTENSIONS.includes(String(name)));
  if (unsupported) return `\uC555\uCD95(${unsupported})\uC744 \uB044\uACE0 \uB2E4\uC2DC \uB0B4\uBCF4\uB0B4 \uC8FC\uC138\uC694.`;
  if (!Array.isArray(json2.meshes) || !json2.meshes.length) return "\uBAA8\uB378 \uC548\uC5D0 \uB3C4\uD615\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.";
  return null;
}

// server/models.ts
var PREFIX2 = "map-models/";
var isModelId = (value) => typeof value === "string" && MODEL_FILE_ID.test(value);
var modelKey = (id) => `${PREFIX2}${id}.glb`;
var newModelId = () => `m-${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
async function listModels(env) {
  const files = [];
  let cursor;
  do {
    const page = await env.MODELS.list({ prefix: PREFIX2, cursor });
    for (const object of page.objects) {
      const id = object.key.slice(PREFIX2.length).replace(/\.glb$/, "");
      if (isModelId(id)) files.push({ id, name: object.customMetadata?.name || id, size: object.size, uploaded: object.uploaded.toISOString() });
    }
    cursor = page.truncated ? page.cursor : void 0;
  } while (cursor);
  return json({ files: files.sort((a, b) => a.uploaded.localeCompare(b.uploaded)) });
}
async function uploadModel(request, env) {
  if (Number(request.headers.get("content-length") || 0) > MAX_GLB_BYTES + 64 * 1024) return error("\uD30C\uC77C\uC774 \uB108\uBB34 \uD07D\uB2C8\uB2E4(\uCD5C\uB300 20MB).", 413);
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string" || !file.size) return error("GLB \uD30C\uC77C\uC744 \uACE8\uB77C \uC8FC\uC138\uC694.", 400);
  if (file.size > MAX_GLB_BYTES) return error("\uD30C\uC77C\uC774 \uB108\uBB34 \uD07D\uB2C8\uB2E4(\uCD5C\uB300 20MB).", 413);
  const buffer = await file.arrayBuffer();
  const problem = checkGlb(buffer);
  if (problem) return error(problem, 400);
  const id = newModelId();
  const name = file.name.replace(/\.glb$/i, "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 80) || "\uBAA8\uB378";
  await env.MODELS.put(modelKey(id), buffer, { httpMetadata: { contentType: "model/gltf-binary" }, customMetadata: { name } });
  return json({ file: { id, name, size: buffer.byteLength } });
}
async function deleteModel(id, env) {
  if (!isModelId(id)) return error("\uBAA8\uB378 \uBC88\uD638\uAC00 \uB9DE\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.", 400);
  const { draft, published } = await readBothVersions(env);
  if (published.models.some((model) => model.modelId === id)) return error("\uACF5\uAC1C \uC9C0\uB3C4\uC5D0 \uB454 \uBAA8\uB378\uC785\uB2C8\uB2E4. \uC9C0\uB3C4\uC5D0\uC11C \uC9C0\uC6B0\uACE0 \uACF5\uAC1C\uD55C \uB4A4 \uC9C0\uC6CC \uC8FC\uC138\uC694.", 409);
  if (draft.models.some((model) => model.modelId === id)) return error("\uCD08\uC548\uC5D0 \uB454 \uBAA8\uB378\uC785\uB2C8\uB2E4. \uC9C0\uB3C4\uC5D0\uC11C \uBA3C\uC800 \uC9C0\uC6CC \uC8FC\uC138\uC694.", 409);
  await env.MODELS.delete(modelKey(id));
  return json({ ok: true });
}
async function getModel(id, request, env) {
  if (!isModelId(id)) return new Response("Not found", { status: 404 });
  const published = (await readPublished(env)).models.some((model) => model.modelId === id);
  if (!published && !await env.isAdmin(request)) return new Response("Not found", { status: 404 });
  const object = await env.MODELS.get(modelKey(id));
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "content-type": "model/gltf-binary",
      "cache-control": published ? "public, max-age=3600" : "private, no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

// server/schema.ts
var ready = null;
function ensureMapTables(env) {
  ready ??= env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS map_places (
      id TEXT PRIMARY KEY NOT NULL DEFAULT 'active', places_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS map_alleys (
      id TEXT PRIMARY KEY NOT NULL DEFAULT 'active', alleys_json TEXT NOT NULL,
      dismissed_json TEXT NOT NULL DEFAULT '[]', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS gps_trails (
      id TEXT PRIMARY KEY NOT NULL, started_at TEXT NOT NULL, points_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS map_building_edits (
      id TEXT PRIMARY KEY NOT NULL CHECK (id IN ('draft', 'published')), edits_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`)
  ]).catch((cause) => {
    ready = null;
    throw cause;
  });
  return ready;
}

// src/data/gamcheon-bus-stops.json
var gamcheon_bus_stops_default = [
  {
    id: "busan-BSB168800201",
    name: "\uBD80\uC0B0\uC11C\uAD50\uD68C",
    next: "\uD55C\uD615\uC11D\uC790\uC720\uC544\uB3D9\uADF9\uC7A5",
    latitude: 35.1020221,
    longitude: 129.0165728,
    routes: [
      "\uC11C\uAD6C3",
      "\uC11C\uAD6C3-1"
    ],
    stopIds: [
      "168800201"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168800201"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168600301",
    name: "\uAE4C\uCE58\uC0C8\uAE38\uC785\uAD6C",
    next: "\uC544\uB984\uB2E4\uC6B4\uAD50\uD68C",
    latitude: 35.1013748,
    longitude: 129.0117167,
    routes: [
      "61",
      "87"
    ],
    stopIds: [
      "168600301"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168600301"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB208270202",
    name: "\uAE4C\uCE58\uC0C8\uAE38\uC785\uAD6C",
    next: "\uB300\uC131\uC0AC",
    latitude: 35.1013347,
    longitude: 129.0113731,
    routes: [
      "61",
      "87"
    ],
    stopIds: [
      "208270202"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB208270202"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168600201",
    name: "\uC138\uC2E0\uBE4C\uB77C",
    next: "\uB300\uC131\uC0AC",
    latitude: 35.1006042,
    longitude: 129.011417,
    routes: [
      "\uC11C\uAD6C2-2"
    ],
    stopIds: [
      "168600201"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168600201"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168800101",
    name: "\uC544\uBBF8\uD30C\uCD9C\uC18C",
    next: "\uC544\uBBF8\uC2DC\uC7A5",
    latitude: 35.1005349,
    longitude: 129.0163013,
    routes: [
      "\uC11C\uAD6C3",
      "\uC11C\uAD6C3-1"
    ],
    stopIds: [
      "168800101"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168800101"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168500302",
    name: "\uCC9C\uC8FC\uAD50\uC544\uD30C\uD2B8",
    next: "\uAE4C\uCE58\uC0C8\uAE38\uC785\uAD6C",
    latitude: 35.1002762,
    longitude: 129.0134317,
    routes: [
      "87"
    ],
    stopIds: [
      "168500302"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168500302"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168380403",
    name: "\uC544\uBBF8\uD30C\uCD9C\uC18C",
    next: "\uAD11\uC131\uC0AC",
    latitude: 35.1002688,
    longitude: 129.0167904,
    routes: [
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C3",
      "\uC11C\uAD6C3-1"
    ],
    stopIds: [
      "168380403"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168380403"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB214130201",
    name: "\uC138\uC2E0\uBE4C\uB77C",
    next: "\uCC9C\uC8FC\uAD50\uC544\uD30C\uD2B8",
    latitude: 35.1002652,
    longitude: 129.0115321,
    routes: [
      "\uC11C\uAD6C2-2"
    ],
    stopIds: [
      "214130201"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB214130201"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB515070000",
    name: "\uCC9C\uC8FC\uAD50\uC544\uD30C\uD2B8",
    next: "\uC138\uC2E0\uBE4C\uB77C",
    latitude: 35.1001908,
    longitude: 129.0135624,
    routes: [
      "\uC11C\uAD6C2-2"
    ],
    stopIds: [
      "515070000"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB515070000"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168600104",
    name: "\uCC9C\uC8FC\uAD50\uC544\uD30C\uD2B8",
    next: "\uC544\uB3D9\uBCF4\uD638\uC885\uD569\uC13C\uD130",
    latitude: 35.1001114,
    longitude: 129.0133274,
    routes: [
      "\uC11C\uAD6C2-2",
      "87"
    ],
    stopIds: [
      "168600104",
      "168600101"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168600104",
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168600101"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168500303",
    name: "\uC544\uB3D9\uBCF4\uD638\uC885\uD569\uC13C\uD130",
    next: "\uCC9C\uC8FC\uAD50\uC544\uD30C\uD2B8",
    latitude: 35.1000816,
    longitude: 129.015931,
    routes: [
      "\uC11C\uAD6C2-2",
      "87"
    ],
    stopIds: [
      "168500303",
      "168500301"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168500303",
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168500301"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168490301",
    name: "\uC544\uBBF8\uD30C\uCD9C\uC18C",
    next: "\uD1A0\uC131\uC5ED\xB7\uC544\uBBF8\uB3D9\uC785\uAD6C",
    latitude: 35.0999988,
    longitude: 129.0167726,
    routes: [
      "134",
      "190"
    ],
    stopIds: [
      "168490301"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168490301"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168500103",
    name: "\uC544\uBBF8\uC2DC\uC7A5",
    next: "\uD1A0\uC131\uC5ED",
    latitude: 35.0999713,
    longitude: 129.0168426,
    routes: [
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2",
      "\uC11C\uAD6C2-2",
      "\uC11C\uAD6C3",
      "\uC11C\uAD6C3-1"
    ],
    stopIds: [
      "168500103"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168500103"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168600103",
    name: "\uC544\uB3D9\uBCF4\uD638\uC885\uD569\uC13C\uD130",
    next: "\uC544\uBBF8\uC2DC\uC7A5",
    latitude: 35.0999034,
    longitude: 129.0160114,
    routes: [
      "\uC11C\uAD6C2-2",
      "87"
    ],
    stopIds: [
      "168600103",
      "168600102"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168600103",
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168600102"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168490202",
    name: "\uC0B0\uC0C1\uAD50\uD68C\xB7\uBE44\uC11D\uBB38\uD654\uB9C8\uC744",
    next: "\uC544\uBBF8\uCCAD\uB144\uD68C",
    latitude: 35.0998039,
    longitude: 129.0120733,
    routes: [
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2"
    ],
    stopIds: [
      "168490202"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168490202"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168590103",
    name: "\uC0B0\uC0C1\uAD50\uD68C\xB7\uBE44\uC11D\uBB38\uD654\uB9C8\uC744",
    next: "\uC544\uBBF8\uB3D9\uACF5\uC601\uC8FC\uCC28\uC7A5",
    latitude: 35.0997435,
    longitude: 129.0121239,
    routes: [
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2"
    ],
    stopIds: [
      "168590103"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168590103"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168490208",
    name: "\uBBF8\uD654\uB2F9\uC288\uD37C",
    next: "\uC0B0\uC0C1\uAD50\uD68C\xB7\uBE44\uC11D\uBB38\uD654\uB9C8\uC744",
    latitude: 35.0994588,
    longitude: 129.0131442,
    routes: [
      "\uC11C\uAD6C2"
    ],
    stopIds: [
      "168490208"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168490208"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168500201",
    name: "\uC544\uBBF8\uD30C\uCD9C\uC18C",
    next: "\uC544\uBBF8\uCD08\uB4F1\uD559\uAD50",
    latitude: 35.099435,
    longitude: 129.0160775,
    routes: [
      "134",
      "190"
    ],
    stopIds: [
      "168500201"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168500201"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168590108",
    name: "\uBBF8\uD654\uB2F9\uC288\uD37C",
    next: "\uC544\uBBF8\uB3D9\uACF5\uC601\uC8FC\uCC28\uC7A5",
    latitude: 35.09933,
    longitude: 129.0130313,
    routes: [
      "\uC11C\uAD6C2"
    ],
    stopIds: [
      "168590108"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168590108"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168490204",
    name: "\uC544\uBBF8\uB3D9\uACF5\uC601\uC8FC\uCC28\uC7A5",
    next: "\uC0B0\uC0C1\uAD50\uD68C\xB7\uBE44\uC11D\uBB38\uD654\uB9C8\uC744",
    latitude: 35.0991888,
    longitude: 129.0133172,
    routes: [
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2"
    ],
    stopIds: [
      "168490204"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168490204"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168490205",
    name: "\uC544\uBBF8\uCCAD\uB144\uD68C",
    next: "\uD55C\uC0D8\uC288\uD37C",
    latitude: 35.0991799,
    longitude: 129.0119605,
    routes: [
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2"
    ],
    stopIds: [
      "168490205"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168490205"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168490203",
    name: "\uC138\uD654\uC5B4\uB9B0\uC774\uC9D1",
    next: "\uC544\uBBF8\uB3D9\uACF5\uC601\uC8FC\uCC28\uC7A5",
    latitude: 35.0991646,
    longitude: 129.0145198,
    routes: [
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2"
    ],
    stopIds: [
      "168490203"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168490203"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168590106",
    name: "\uC544\uBBF8\uCCAD\uB144\uD68C",
    next: "\uC0B0\uC0C1\uAD50\uD68C\xB7\uBE44\uC11D\uBB38\uD654\uB9C8\uC744",
    latitude: 35.0990847,
    longitude: 129.0121164,
    routes: [
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2"
    ],
    stopIds: [
      "168590106"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168590106"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168590105",
    name: "\uC544\uBBF8\uB3D9\uACF5\uC601\uC8FC\uCC28\uC7A5",
    next: "\uC138\uD654\uC5B4\uB9B0\uC774\uC9D1",
    latitude: 35.0990125,
    longitude: 129.0134309,
    routes: [
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2"
    ],
    stopIds: [
      "168590105"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168590105"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168490206",
    name: "\uC544\uBBF8\uCD08\uB4F1\uD559\uAD50",
    next: "\uC138\uD654\uC5B4\uB9B0\uC774\uC9D1",
    latitude: 35.0989047,
    longitude: 129.0158053,
    routes: [
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2"
    ],
    stopIds: [
      "168490206"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168490206"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168590104",
    name: "\uC138\uD654\uC5B4\uB9B0\uC774\uC9D1",
    next: "\uC544\uBBF8\uCD08\uB4F1\uD559\uAD50",
    latitude: 35.0988833,
    longitude: 129.0147734,
    routes: [
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2"
    ],
    stopIds: [
      "168590104"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168590104"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168590107",
    name: "\uC544\uBBF8\uCD08\uB4F1\uD559\uAD50",
    next: "\uAD11\uC131\uC0AC",
    latitude: 35.0988202,
    longitude: 129.0157726,
    routes: [
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2"
    ],
    stopIds: [
      "168590107"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168590107"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168490201",
    name: "\uAD11\uC131\uC0AC",
    next: "\uC544\uBBF8\uCD08\uB4F1\uD559\uAD50",
    latitude: 35.0987784,
    longitude: 129.0163951,
    routes: [
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2"
    ],
    stopIds: [
      "168490201"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168490201"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168590101",
    name: "\uAD11\uC131\uC0AC",
    next: "\uC544\uBBF8\uC2DC\uC7A5",
    latitude: 35.0986427,
    longitude: 129.0163449,
    routes: [
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2"
    ],
    stopIds: [
      "168590101"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168590101"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168490207",
    name: "\uD55C\uC0D8\uC288\uD37C",
    next: "\uC544\uBBF8\uB3D9\uAC10\uCC9C\uC0BC\uAC70\uB9AC",
    latitude: 35.0986386,
    longitude: 129.0120141,
    routes: [
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2"
    ],
    stopIds: [
      "168490207"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168490207"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB502390000",
    name: "\uC544\uBBF8\uC0B0 \uB300\uC131\uC0AC",
    next: "\uAC10\uCC9C\uBB38\uD654\uB9C8\uC744\xB7\uBD80\uC0B0\uAD50\uC721\uC5ED\uC0AC\uAD00",
    latitude: 35.0985189,
    longitude: 129.0115276,
    routes: [
      "\uC0AC\uD558\uAD6C1"
    ],
    stopIds: [
      "502390000"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB502390000"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB517590000",
    name: "\uB300\uC131\uC0AC",
    next: "\uAE4C\uCE58\uC0C8\uAE38\uC785\uAD6C",
    latitude: 35.0984423,
    longitude: 129.0115402,
    routes: [
      "61"
    ],
    stopIds: [
      "517590000"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB517590000"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB214130101",
    name: "\uB300\uC131\uC0AC",
    next: "\uAC10\uCC9C\uBB38\uD654\uB9C8\uC744\xB7\uBD80\uC0B0\uAD50\uC721\uC5ED\uC0AC\uAD00",
    latitude: 35.0984326,
    longitude: 129.0112805,
    routes: [
      "\uC11C\uAD6C2-2",
      "61"
    ],
    stopIds: [
      "214130101",
      "517600000"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB214130101",
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB517600000"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "osm-node-9657838805",
    name: "\uB300\uC9C4\uC288\uD37C",
    next: "\uC544\uBBF8\uCCAD\uB144\uD68C",
    latitude: 35.0983199,
    longitude: 129.0119922,
    routes: [
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2"
    ],
    stopIds: [
      "168590102"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168590102"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168590203",
    name: "\uC544\uBBF8\uB3D9\uAC10\uCC9C\uC0BC\uAC70\uB9AC",
    next: "\uAC10\uCC9C\uBB38\uD654\uB9C8\uC744\xB7\uBD80\uC0B0\uAD50\uC721\uC5ED\uC0AC\uAD00",
    latitude: 35.0980416,
    longitude: 129.0113878,
    routes: [
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2"
    ],
    stopIds: [
      "168590203"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168590203"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB177890203",
    name: "\uD55C\uC0D8\uC288\uD37C",
    next: "\uB300\uC9C4\uC288\uD37C",
    latitude: 35.0978101,
    longitude: 129.0114563,
    routes: [
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2",
      "\uC11C\uAD6C2-2"
    ],
    stopIds: [
      "177890203"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB177890203"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168480201",
    name: "\uC544\uBBF8\uCD08\uB4F1\uD559\uAD50",
    next: "\uC544\uBBF8\uD30C\uCD9C\uC18C",
    latitude: 35.0978095,
    longitude: 129.0172983,
    routes: [
      "134",
      "190"
    ],
    stopIds: [
      "168480201"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168480201"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168490101",
    name: "\uC544\uBBF8\uCD08\uB4F1\uD559\uAD50",
    next: "\uD558\uB3D9\uC0C1\uD68C",
    latitude: 35.0976906,
    longitude: 129.0170938,
    routes: [
      "134",
      "190"
    ],
    stopIds: [
      "168490101"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168490101"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "osm-node-3859163058",
    name: "\uAC10\uCC9C\uBB38\uD654\uB9C8\uC744\xB7\uBD80\uC0B0\uAD50\uC721\uC5ED\uC0AC\uAD00",
    next: "\uC544\uBBF8\uC0B0 \uB300\uC131\uC0AC",
    latitude: 35.0973041,
    longitude: 129.0106455,
    positionSource: "OpenStreetMap \uAE30\uC874 \uB4F1\uB85D \uC704\uCE58 \uC720\uC9C0",
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2",
      "\uC11C\uAD6C2-2",
      "61"
    ],
    stopIds: [
      "177890201",
      "517490000"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB177890201",
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB517490000"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "osm-node-3859163057",
    name: "\uAC10\uCC9C\uBB38\uD654\uB9C8\uC744\xB7\uBD80\uC0B0\uAD50\uC721\uC5ED\uC0AC\uAD00",
    next: "\uAD6C\uAC10",
    latitude: 35.0972086,
    longitude: 129.0101505,
    positionSource: "OpenStreetMap \uAE30\uC874 \uB4F1\uB85D \uC704\uCE58 \uC720\uC9C0",
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2",
      "\uC11C\uAD6C2-2",
      "61"
    ],
    stopIds: [
      "168590201",
      "517500000"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168590201",
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB517500000"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB177890202",
    name: "\uAD6C\uAC10",
    next: "\uAC10\uCC9C\uBB38\uD654\uB9C8\uC744\xB7\uBD80\uC0B0\uAD50\uC721\uC5ED\uC0AC\uAD00",
    latitude: 35.0956798,
    longitude: 129.0105951,
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2-2",
      "61"
    ],
    stopIds: [
      "177890202",
      "519040000"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB177890202",
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB519040000"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB168590202",
    name: "\uAD6C\uAC10",
    next: "\uAC10\uCC9C2\uB3D9\uD589\uC815\uBCF5\uC9C0\uC13C\uD130",
    latitude: 35.09559,
    longitude: 129.0103809,
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2-2",
      "61"
    ],
    stopIds: [
      "168590202",
      "519030000"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168590202",
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB519030000"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB177890303",
    name: "\uAC10\uCC9C2\uB3D9\uD589\uC815\uBCF5\uC9C0\uC13C\uD130",
    next: "\uAC10\uCC9C2\uB3D9\uC0BC\uAC70\uB9AC",
    latitude: 35.0944935,
    longitude: 129.0100766,
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2-2"
    ],
    stopIds: [
      "177890303"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB177890303"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB215880203",
    name: "\uAC10\uCC9C2\uB3D9\uD589\uC815\uBCF5\uC9C0\uC13C\uD130",
    next: "\uAD6C\uAC10",
    latitude: 35.0942518,
    longitude: 129.0101845,
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2-2"
    ],
    stopIds: [
      "215880203"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB215880203"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB177890301",
    name: "\uAC10\uCC9C2\uB3D9\uC0BC\uAC70\uB9AC",
    next: "\uAC10\uCC9C2\uB3D9\uC0C8\uB9C8\uC744\uAE08\uACE0",
    latitude: 35.0928666,
    longitude: 129.008809,
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2-2",
      "61"
    ],
    stopIds: [
      "177890301",
      "517440000"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB177890301",
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB517440000"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB215880201",
    name: "\uAC10\uCC9C2\uB3D9\uC0BC\uAC70\uB9AC",
    next: "\uAC10\uCC9C2\uB3D9\uD589\uC815\uBCF5\uC9C0\uC13C\uD130",
    latitude: 35.0928287,
    longitude: 129.0090255,
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2-2",
      "61"
    ],
    stopIds: [
      "215880201",
      "517430000"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB215880201",
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB517430000"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB177890302",
    name: "\uAC10\uCC9C2\uB3D9\uC0C8\uB9C8\uC744\uAE08\uACE0",
    next: "\uAC10\uCC9C2\uB3D9",
    latitude: 35.0924059,
    longitude: 129.00846,
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2-2"
    ],
    stopIds: [
      "177890302"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB177890302"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB215880202",
    name: "\uAC10\uCC9C2\uB3D9\uC0C8\uB9C8\uC744\uAE08\uACE0",
    next: "\uAC10\uCC9C2\uB3D9\uC0BC\uAC70\uB9AC",
    latitude: 35.0918924,
    longitude: 129.0083461,
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2-2"
    ],
    stopIds: [
      "215880202"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB215880202"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB188130504",
    name: "\uAC10\uCC9C2\uB3D9",
    next: "\uAC10\uCC9C2\uB3D9\uC0C8\uB9C8\uC744\uAE08\uACE0",
    latitude: 35.0908549,
    longitude: 129.0069303,
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2-2",
      "61"
    ],
    stopIds: [
      "188130504",
      "188130103"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB188130504",
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB188130103"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB215880103",
    name: "\uAC10\uCC9C2\uB3D9",
    next: "\uC218\uD611",
    latitude: 35.0908359,
    longitude: 129.0066065,
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2-2",
      "61"
    ],
    stopIds: [
      "215880103",
      "177890101"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB215880103",
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB177890101"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB188120203",
    name: "\uBD80\uC77C\uACE0\uB4F1\uD559\uAD50",
    next: "\uC0BC\uC131\uC5EC\uACE0",
    latitude: 35.089639,
    longitude: 129.0000974,
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1"
    ],
    stopIds: [
      "188120203"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB188120203"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB188130101",
    name: "\uC218\uD611",
    next: "\uAC10\uCC9C2\uB3D9",
    latitude: 35.0893096,
    longitude: 129.0056767,
    routes: [
      "61"
    ],
    stopIds: [
      "188130101"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB188130101"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB215880105",
    name: "\uC218\uD611",
    next: "\uAC10\uCC9C1\uB3D9\uC8FC\uBBFC\uC13C\uD130",
    latitude: 35.0891732,
    longitude: 129.0053923,
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2-2"
    ],
    stopIds: [
      "215880105"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB215880105"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB177890102",
    name: "\uC218\uD611",
    next: "\uAC10\uCC9C\uC0AC\uAC70\uB9AC",
    latitude: 35.088916,
    longitude: 129.0053075,
    routes: [
      "61"
    ],
    stopIds: [
      "177890102"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB177890102"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB178160103",
    name: "\uBD80\uC77C\uACE0\uB4F1\uD559\uAD50",
    next: "\uAC10\uCC9C\uC0AC\uAC70\uB9AC",
    latitude: 35.0888354,
    longitude: 129.0006881,
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1"
    ],
    stopIds: [
      "178160103"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB178160103"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB188130506",
    name: "\uC218\uD611",
    next: "\uAC10\uCC9C2\uB3D9",
    latitude: 35.0888051,
    longitude: 129.0055063,
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2-2"
    ],
    stopIds: [
      "188130506"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB188130506"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB178160101",
    name: "\uBD80\uC77C\uC804\uC790\uB514\uC790\uC778\uACE0\uAD50",
    next: "\uAC10\uCC9C\uC0AC\uAC70\uB9AC",
    latitude: 35.0887361,
    longitude: 129.000829,
    routes: [
      "16",
      "171",
      "172",
      "6",
      "96-1"
    ],
    stopIds: [
      "178160101"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB178160101"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB188120201",
    name: "\uBD80\uC0B0\uCC9C\uC5F0\uAC00\uC2A4\uBC1C\uC804\uC18C",
    next: "\uBD80\uC77C\uC804\uC790\uB514\uC790\uC778\uACE0\uAD50",
    latitude: 35.088261,
    longitude: 129.0027885,
    routes: [
      "16",
      "171",
      "172",
      "3006",
      "6",
      "96-1"
    ],
    stopIds: [
      "188120201"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB188120201"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB215880104",
    name: "\uAC10\uCC9C\uC0AC\uAC70\uB9AC",
    next: "\uAC10\uCC9C119\uC548\uC804\uC13C\uD130",
    latitude: 35.0880864,
    longitude: 129.005094,
    routes: [
      "\uC11C\uAD6C2-2"
    ],
    stopIds: [
      "215880104"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB215880104"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB188120202",
    name: "\uAC10\uCC9C1\uB3D9\uC8FC\uBBFC\uC13C\uD130",
    next: "\uBD80\uC77C\uACE0\uB4F1\uD559\uAD50",
    latitude: 35.087875,
    longitude: 129.0042867,
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1"
    ],
    stopIds: [
      "188120202"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB188120202"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB188130505",
    name: "\uAC10\uCC9C\uC0AC\uAC70\uB9AC",
    next: "\uC218\uD611",
    latitude: 35.0878376,
    longitude: 129.0052228,
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2-2"
    ],
    stopIds: [
      "188130505"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB188130505"
    ],
    checkedAt: "2026-10-24"
  },
  {
    id: "busan-BSB188130102",
    name: "\uAC10\uCC9C\uC6B0\uCCB4\uAD6D",
    next: "\uC218\uD611",
    latitude: 35.0877835,
    longitude: 129.0052637,
    routes: [
      "61"
    ],
    stopIds: [
      "188130102"
    ],
    source: [
      "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB188130102"
    ],
    checkedAt: "2026-10-24"
  }
];

// src/data/mapAmenities.ts
var points = [
  [6924043187, "toilets", 35.0985138, 129.0091825],
  [6924087486, "toilets", 35.0977265, 129.0105011],
  [6924087487, "toilets", 35.0985277, 129.0100606],
  [9657908525, "toilets", 35.0996994, 129.0122466],
  [11166195005, "toilets", 35.0879178, 129.015572],
  [11853831032, "toilets", 35.0972918, 129.0094237],
  [11853836253, "toilets", 35.0936128, 129.0026825],
  [12878495601, "toilets", 35.0967595, 129.0081532],
  [13075407401, "toilets", 35.0943191, 129.0080254],
  [13509548714, "toilets", 35.0976417, 129.0083769]
];
var toiletCount = 0;
var osmAmenities = points.map(([id, category, latitude, longitude]) => ({
  id: `osm-node-${id}`,
  name: `\uD654\uC7A5\uC2E4 \uC704\uCE58 ${++toiletCount}`,
  category,
  latitude,
  longitude,
  description: "OpenStreetMap \uC704\uCE58 \uC790\uB8CC \xB7 \uAC1C\uBC29 \uC5EC\uBD80\uC640 \uC6B4\uC601\uC2DC\uAC04 \uD655\uC778 \uC804"
}));
var REGISTERED_BUS_STOPS = gamcheon_bus_stops_default.map((stop) => ({
  id: stop.id,
  name: `${stop.name} (${stop.next} \uBC29\uBA74)`,
  category: "bus_stop",
  latitude: stop.latitude,
  longitude: stop.longitude,
  description: `\uBC84\uC2A4 ${stop.routes.join(" \xB7 ")} \xB7 \uB2E4\uC74C \uC815\uB958\uC7A5: ${stop.next} \xB7 ${stop.checkedAt} \uBD80\uC0B0\uBC84\uC2A4\uC815\uBCF4\uC2DC\uC2A4\uD15C \uC815\uB958\uC18C \uC790\uB8CC`
}));
var MAP_AMENITIES = [...osmAmenities, ...REGISTERED_BUS_STOPS];

// src/places/mapPlaces.ts
function cleanMapPlaces(value) {
  if (!Array.isArray(value) || value.length > 500) return null;
  const ids = /* @__PURE__ */ new Set();
  const places = [];
  for (const item of value) {
    const p = item;
    if (!p || typeof p.id !== "string" || !p.id || p.id.length > 100 || ids.has(p.id) || typeof p.name !== "string" || !p.name.trim() || p.name.length > 80 || !["shop", "attraction", "toilets", "bus_stop"].includes(p.category ?? "") || typeof p.longitude !== "number" || !Number.isFinite(p.longitude) || typeof p.latitude !== "number" || !Number.isFinite(p.latitude) || !isInsideGamcheonMap(p.longitude, p.latitude) || p.address !== void 0 && (typeof p.address !== "string" || p.address.length > 160) || p.description !== void 0 && (typeof p.description !== "string" || p.description.length > 500)) return null;
    ids.add(p.id);
    places.push({
      id: p.id,
      name: p.name.trim(),
      category: p.category,
      longitude: p.longitude,
      latitude: p.latitude,
      address: p.address ?? "",
      description: p.description ?? ""
    });
  }
  return places;
}

// server/places.ts
var defaults = MAP_AMENITIES.filter((p) => isInsideGamcheonMap(p.longitude, p.latitude));
async function readPlaces(env) {
  const row = await env.DB.prepare("SELECT places_json FROM map_places WHERE id = 'active'").first();
  return json({ places: row ? cleanMapPlaces(JSON.parse(row.places_json)) ?? defaults : defaults });
}
async function savePlaces(request, env) {
  const body = await readJson(request);
  const places = cleanMapPlaces(body?.places);
  if (!places) return error("\uC7A5\uC18C \uC774\uB984\xB7\uBD84\uB958\xB7\uC9C0\uB3C4 \uC548\uC758 \uC704\uCE58\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.", 400);
  await env.DB.prepare(`INSERT INTO map_places (id, places_json, updated_at) VALUES ('active', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET places_json = excluded.places_json, updated_at = CURRENT_TIMESTAMP`).bind(JSON.stringify(places)).run();
  return json({ places });
}

// src/data/busStopLinks.ts
var stopIds = new Map(gamcheon_bus_stops_default.map((stop) => [stop.id, stop.stopIds]));
var busStopIdsFor = (placeId) => stopIds.get(placeId);

// server/busArrivals.ts
var cache = /* @__PURE__ */ new Map();
var pending = /* @__PURE__ */ new Map();
var failedUntil = /* @__PURE__ */ new Map();
var CACHE_MS = 3e4;
var decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
function field(xml, tag) {
  return decode(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`).exec(xml)?.[1]?.trim() ?? "").slice(0, 100);
}
function nextBus(xml, n) {
  const value = field(xml, `min${n}`);
  if (!value) return null;
  const minutes = /^\d+$/.test(value) ? Number(value) : null;
  const count = field(xml, `station${n}`);
  return { minutes, status: minutes === null ? value : null, stopsAway: /^\d+$/.test(count) ? Number(count) : null };
}
function parseBusArrivals(xml) {
  if (field(xml, "resultCode") !== "00") throw new Error("upstream service error");
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g)].map(([, item]) => ({
    route: field(item, "lineno"),
    type: field(item, "bustype"),
    first: nextBus(item, 1),
    second: nextBus(item, 2)
  })).filter((item) => item.route);
}
async function stopArrivals(key, stopId) {
  const saved = cache.get(stopId);
  if (saved && saved.until > Date.now()) return saved.value;
  const failed = failedUntil.get(stopId);
  if (failed && failed > Date.now()) throw new Error("upstream recently failed");
  let job = pending.get(stopId);
  if (!job) {
    job = (async () => {
      try {
        let decodedKey = key;
        try {
          decodedKey = decodeURIComponent(key);
        } catch {
        }
        const upstream = new URL("https://apis.data.go.kr/6260000/BusanBIMS/stopArrByBstopid");
        upstream.searchParams.set("serviceKey", decodedKey);
        upstream.searchParams.set("bstopid", stopId);
        const response = await fetch(upstream, { signal: AbortSignal.timeout(8e3) });
        if (!response.ok) throw new Error("upstream request failed");
        const xml = await response.text();
        if (xml.length > 1e6) throw new Error("upstream response too large");
        const value = { stopId, arrivals: parseBusArrivals(xml), updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
        cache.set(stopId, { until: Date.now() + CACHE_MS, value });
        failedUntil.delete(stopId);
        return value;
      } catch (cause) {
        failedUntil.set(stopId, Date.now() + CACHE_MS);
        throw cause;
      }
    })();
    pending.set(stopId, job);
    const settled = job;
    settled.catch(() => void 0).finally(() => {
      if (pending.get(stopId) === settled) pending.delete(stopId);
    });
  }
  return job;
}
async function busArrivals(env, url) {
  const placeId = url.searchParams.get("placeId") ?? "";
  const stopIds2 = busStopIdsFor(placeId);
  if (!stopIds2?.length) return error("\uC774 \uC815\uB958\uC7A5\uC740 \uB3C4\uCC29\uC815\uBCF4 \uC5F0\uACB0\uC744 \uC900\uBE44 \uC911\uC785\uB2C8\uB2E4.", 404);
  if (!env.busanBusApiKey) return error("\uBC84\uC2A4 \uB3C4\uCC29\uC815\uBCF4 \uC11C\uBE44\uC2A4 \uC5F0\uACB0\uC744 \uC900\uBE44 \uC911\uC785\uB2C8\uB2E4.", 503);
  const key = env.busanBusApiKey;
  const results = await Promise.allSettled(stopIds2.map((stopId) => stopArrivals(key, stopId)));
  const ok = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  if (!ok.length) return error("\uB3C4\uCC29\uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uB4A4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.", 502);
  const soon = (item) => item.first?.minutes ?? Number.POSITIVE_INFINITY;
  return json({
    stopIds: ok.map((item) => item.stopId),
    arrivals: ok.flatMap((item) => item.arrivals).sort((a, b) => soon(a) - soon(b)),
    updatedAt: ok.map((item) => item.updatedAt).sort()[0]
  });
}

// server/index.ts
var routes = [
  ["GET", /^\/api\/map-bus-arrivals$/, false, (_request, env, url) => busArrivals(env, url)],
  ["GET", /^\/api\/map-places$/, false, (_request, env) => readPlaces(env)],
  ["GET", /^\/api\/admin\/map-places$/, true, (_request, env) => readPlaces(env)],
  ["PUT", /^\/api\/admin\/map-places$/, true, (request, env) => savePlaces(request, env)],
  ["GET", /^\/api\/map-alleys$/, false, (_request, env) => publicAlleys(env)],
  ["GET", /^\/api\/admin\/map-alleys$/, true, (_request, env) => adminAlleys(env)],
  ["PUT", /^\/api\/admin\/map-alleys$/, true, (request, env) => saveAlleys(request, env)],
  ["GET", /^\/api\/admin\/gps-trails$/, true, (_request, env) => listTrails(env)],
  ["POST", /^\/api\/admin\/gps-trails$/, true, (request, env) => saveTrail(request, env)],
  ["DELETE", /^\/api\/admin\/gps-trails$/, true, (_request, env, url) => deleteTrail(url, env)],
  ["GET", /^\/api\/map-buildings$/, false, (_request, env) => publicBuildings(env)],
  ["GET", /^\/api\/admin\/map-buildings$/, true, (_request, env) => adminBuildings(env)],
  ["PUT", /^\/api\/admin\/map-buildings$/, true, (request, env) => saveDraft(request, env)],
  ["POST", /^\/api\/admin\/map-buildings\/publish$/, true, (_request, env) => publish(env)],
  ["POST", /^\/api\/admin\/map-buildings\/discard$/, true, (_request, env) => discard(env)],
  ["GET", /^\/api\/map-models\/([\w-]+)$/, false, (request, env, _url, [id]) => getModel(id, request, env)],
  ["GET", /^\/api\/admin\/map-models$/, true, (_request, env) => listModels(env)],
  ["POST", /^\/api\/admin\/map-models$/, true, (request, env) => uploadModel(request, env)],
  ["DELETE", /^\/api\/admin\/map-models\/([\w-]+)$/, true, (_request, env, _url, [id]) => deleteModel(id, env)],
  ["GET", /^\/api\/map-images\/([\w-]+)$/, false, (request, env, _url, [id]) => getPhoto(id, request, env)],
  ["POST", /^\/api\/admin\/map-images$/, true, (request, env) => uploadPhoto(request, env)],
  ["DELETE", /^\/api\/admin\/map-images\/([\w-]+)$/, true, (_request, env, _url, [id]) => deletePhoto(id, env)]
];
var MAP_API_PATHS = routes.map(([, pattern]) => pattern.source);
async function handleApi(request, env, url = new URL(request.url)) {
  const matches = routes.filter(([, pattern2]) => pattern2.test(url.pathname));
  if (!matches.length) return error("\uC5C6\uB294 \uC8FC\uC18C\uC785\uB2C8\uB2E4.", 404);
  const route = matches.find(([method]) => method === request.method);
  if (!route) return error("\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uC694\uCCAD\uC785\uB2C8\uB2E4.", 405);
  const [, pattern, admin, handler] = route;
  if (!fromThisApp(request, url)) return error("\uC774 \uC0AC\uC774\uD2B8 \uD654\uBA74\uC5D0\uC11C \uBCF4\uB0B8 \uC694\uCCAD\uB9CC \uBC1B\uC2B5\uB2C8\uB2E4.", 403);
  if (admin && !await env.isAdmin(request)) return error("\uC6B4\uC601\uC790\uB85C \uB85C\uADF8\uC778\uD574 \uC8FC\uC138\uC694.", 403);
  try {
    await ensureMapTables(env);
    return await handler(request, env, url, pattern.exec(url.pathname).slice(1));
  } catch (cause) {
    console.error("map api failed", request.method, url.pathname, cause);
    return error("\uCC98\uB9AC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uB4A4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.", 500);
  }
}
export {
  MAP_API_PATHS,
  handleApi
};

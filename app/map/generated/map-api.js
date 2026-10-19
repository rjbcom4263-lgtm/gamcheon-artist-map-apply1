// 자동 생성 파일입니다. 고치지 말고 art-map 저장소의 server/를 고친 뒤 npm run export:site로 다시 만드세요.
// Bundled from https://github.com/InSeok211/art-map at 134714b + uncommitted changes.

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
  const points2 = body.points.flatMap((point) => {
    if (!Array.isArray(point) || point.length !== 4 || !point.every((part) => typeof part === "number" && Number.isFinite(part))) return [];
    const [lng, lat, accuracy, time] = point;
    return insideWorkArea(lng, lat) ? [[round7(lng), round7(lat), Math.round(accuracy * 10) / 10, Math.round(time)]] : [];
  });
  if (points2.length < 5) return error("\uAC10\uCC9C \uC791\uC5C5 \uBC94\uC704 \uC548\uC5D0\uC11C \uAE30\uB85D\uD55C \uC704\uCE58\uAC00 \uB108\uBB34 \uC801\uC2B5\uB2C8\uB2E4.", 400);
  const startedAt = new Date(body.startedAt).toISOString();
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

// server/buildings.ts
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
  return json({ draft });
}
async function publish(env) {
  const { draft } = await readBothVersions(env);
  await write(env, "published", draft);
  return json({ published: draft });
}
async function discard(env) {
  const published = await readPublished(env);
  await write(env, "draft", published);
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
var PREFIX = "map-models/";
var isModelId = (value) => typeof value === "string" && MODEL_FILE_ID.test(value);
var modelKey = (id) => `${PREFIX}${id}.glb`;
var newModelId = () => `m-${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
async function listModels(env) {
  const files = [];
  let cursor;
  do {
    const page = await env.MODELS.list({ prefix: PREFIX, cursor });
    for (const object of page.objects) {
      const id = object.key.slice(PREFIX.length).replace(/\.glb$/, "");
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
      "cache-control": published ? "public, max-age=86400" : "private, no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

// server/images.ts
var PREFIX2 = "map-images/";
var MAX_PHOTO_BYTES = 2 * 1024 * 1024;
var photoKey = (id) => `${PREFIX2}${id}`;
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
async function getPhoto(id, request, env) {
  if (!PHOTO_FILE_ID.test(id)) return new Response("Not found", { status: 404 });
  const published = (await readPublished(env)).workshop?.photo === id;
  if (!published && !await env.isAdmin(request)) return new Response("Not found", { status: 404 });
  const object = await env.MODELS.get(photoKey(id));
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "image/jpeg",
      "cache-control": published ? "public, max-age=86400" : "private, no-store",
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
    id: "busan-BSB215880203",
    name: "\uAC10\uCC9C2\uB3D9\uD589\uC815\uBCF5\uC9C0\uC13C\uD130",
    next: "\uAD6C\uAC10",
    latitude: 35.0942518,
    longitude: 129.0101845,
    source: "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB215880203",
    checkedAt: "2026-10-19",
    replaces: null,
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2-2"
    ]
  },
  {
    id: "busan-BSB215880201",
    name: "\uAC10\uCC9C2\uB3D9\uC0BC\uAC70\uB9AC",
    next: "\uAC10\uCC9C2\uB3D9\uD589\uC815\uBCF5\uC9C0\uC13C\uD130",
    latitude: 35.0928287,
    longitude: 129.0090255,
    source: "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB215880201",
    checkedAt: "2026-10-19",
    replaces: null,
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2-2"
    ]
  },
  {
    id: "busan-BSB177890203",
    name: "\uD55C\uC0D8\uC288\uD37C",
    next: "\uB300\uC9C4\uC288\uD37C",
    latitude: 35.0978101,
    longitude: 129.0114563,
    source: "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB177890203",
    checkedAt: "2026-10-19",
    replaces: null,
    routes: [
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2",
      "\uC11C\uAD6C2-2"
    ]
  },
  {
    id: "busan-BSB168490207",
    name: "\uD55C\uC0D8\uC288\uD37C",
    next: "\uC544\uBBF8\uB3D9\uAC10\uCC9C\uC0BC\uAC70\uB9AC",
    latitude: 35.0986386,
    longitude: 129.0120141,
    source: "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168490207",
    checkedAt: "2026-10-19",
    replaces: null,
    routes: [
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2"
    ]
  },
  {
    id: "busan-BSB177890202",
    name: "\uAD6C\uAC10",
    next: "\uAC10\uCC9C\uBB38\uD654\uB9C8\uC744\xB7\uBD80\uC0B0\uAD50\uC721\uC5ED\uC0AC\uAD00",
    latitude: 35.0956798,
    longitude: 129.0105951,
    source: "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB177890202",
    checkedAt: "2026-10-19",
    replaces: null,
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2-2"
    ]
  },
  {
    id: "busan-BSB168590203",
    name: "\uC544\uBBF8\uB3D9\uAC10\uCC9C\uC0BC\uAC70\uB9AC",
    next: "\uAC10\uCC9C\uBB38\uD654\uB9C8\uC744\xB7\uBD80\uC0B0\uAD50\uC721\uC5ED\uC0AC\uAD00",
    latitude: 35.0980416,
    longitude: 129.0113878,
    source: "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168590203",
    checkedAt: "2026-10-19",
    replaces: null,
    routes: [
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2"
    ]
  },
  {
    id: "busan-BSB177890303",
    name: "\uAC10\uCC9C2\uB3D9\uD589\uC815\uBCF5\uC9C0\uC13C\uD130",
    next: "\uAC10\uCC9C2\uB3D9\uC0BC\uAC70\uB9AC",
    latitude: 35.0944935,
    longitude: 129.0100766,
    source: "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB177890303",
    checkedAt: "2026-10-19",
    replaces: null,
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2-2"
    ]
  },
  {
    id: "busan-BSB177890301",
    name: "\uAC10\uCC9C2\uB3D9\uC0BC\uAC70\uB9AC",
    next: "\uAC10\uCC9C2\uB3D9\uC0C8\uB9C8\uC744\uAE08\uACE0",
    latitude: 35.0928666,
    longitude: 129.008809,
    source: "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB177890301",
    checkedAt: "2026-10-19",
    replaces: null,
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2-2"
    ]
  },
  {
    id: "busan-BSB168590202",
    name: "\uAD6C\uAC10",
    next: "\uAC10\uCC9C2\uB3D9\uD589\uC815\uBCF5\uC9C0\uC13C\uD130",
    latitude: 35.09559,
    longitude: 129.0103809,
    source: "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168590202",
    checkedAt: "2026-10-19",
    replaces: null,
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2-2"
    ]
  },
  {
    id: "busan-BSB214130101",
    name: "\uB300\uC131\uC0AC",
    next: "\uAC10\uCC9C\uBB38\uD654\uB9C8\uC744\xB7\uBD80\uC0B0\uAD50\uC721\uC5ED\uC0AC\uAD00",
    latitude: 35.0984326,
    longitude: 129.0112805,
    source: "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB214130101",
    checkedAt: "2026-10-19",
    replaces: null,
    routes: [
      "\uC11C\uAD6C2-2"
    ]
  },
  {
    id: "busan-BSB168590103",
    name: "\uC0B0\uC0C1\uAD50\uD68C\xB7\uBE44\uC11D\uBB38\uD654\uB9C8\uC744",
    next: "\uC544\uBBF8\uB3D9\uACF5\uC601\uC8FC\uCC28\uC7A5",
    latitude: 35.0997435,
    longitude: 129.0121239,
    source: "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168590103",
    checkedAt: "2026-10-19",
    replaces: null,
    routes: [
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2"
    ]
  },
  {
    id: "busan-BSB168590106",
    name: "\uC544\uBBF8\uCCAD\uB144\uD68C",
    next: "\uC0B0\uC0C1\uAD50\uD68C\xB7\uBE44\uC11D\uBB38\uD654\uB9C8\uC744",
    latitude: 35.0990847,
    longitude: 129.0121164,
    source: "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168590106",
    checkedAt: "2026-10-19",
    replaces: null,
    routes: [
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2"
    ]
  },
  {
    id: "busan-BSB168590102",
    name: "\uB300\uC9C4\uC288\uD37C",
    next: "\uC544\uBBF8\uCCAD\uB144\uD68C",
    latitude: 35.0983199,
    longitude: 129.0119922,
    source: "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168590102",
    checkedAt: "2026-10-19",
    replaces: "osm-node-9657838805",
    routes: [
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2"
    ]
  },
  {
    id: "busan-BSB168490202",
    name: "\uC0B0\uC0C1\uAD50\uD68C\xB7\uBE44\uC11D\uBB38\uD654\uB9C8\uC744",
    next: "\uC544\uBBF8\uCCAD\uB144\uD68C",
    latitude: 35.0998039,
    longitude: 129.0120733,
    source: "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168490202",
    checkedAt: "2026-10-19",
    replaces: null,
    routes: [
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2"
    ]
  },
  {
    id: "busan-BSB168490205",
    name: "\uC544\uBBF8\uCCAD\uB144\uD68C",
    next: "\uD55C\uC0D8\uC288\uD37C",
    latitude: 35.0991799,
    longitude: 129.0119605,
    source: "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168490205",
    checkedAt: "2026-10-19",
    replaces: null,
    routes: [
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2"
    ]
  },
  {
    id: "busan-BSB168590108",
    name: "\uBBF8\uD654\uB2F9\uC288\uD37C",
    next: "\uC544\uBBF8\uB3D9\uACF5\uC601\uC8FC\uCC28\uC7A5",
    latitude: 35.09933,
    longitude: 129.0130313,
    source: "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168590108",
    checkedAt: "2026-10-19",
    replaces: null,
    routes: [
      "\uC11C\uAD6C2"
    ]
  },
  {
    id: "busan-BSB168490208",
    name: "\uBBF8\uD654\uB2F9\uC288\uD37C",
    next: "\uC0B0\uC0C1\uAD50\uD68C\xB7\uBE44\uC11D\uBB38\uD654\uB9C8\uC744",
    latitude: 35.0994588,
    longitude: 129.0131442,
    source: "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168490208",
    checkedAt: "2026-10-19",
    replaces: null,
    routes: [
      "\uC11C\uAD6C2"
    ]
  },
  {
    id: "busan-BSB502390000",
    name: "\uC544\uBBF8\uC0B0 \uB300\uC131\uC0AC",
    next: "\uAC10\uCC9C\uBB38\uD654\uB9C8\uC744\xB7\uBD80\uC0B0\uAD50\uC721\uC5ED\uC0AC\uAD00",
    latitude: 35.0985189,
    longitude: 129.0115276,
    source: "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB502390000",
    checkedAt: "2026-10-19",
    replaces: null,
    routes: [
      "\uC0AC\uD558\uAD6C1"
    ]
  },
  {
    id: "busan-BSB168590201",
    name: "\uAC10\uCC9C\uBB38\uD654\uB9C8\uC744\xB7\uBD80\uC0B0\uAD50\uC721\uC5ED\uC0AC\uAD00",
    next: "\uAD6C\uAC10",
    latitude: 35.0972086,
    longitude: 129.0101505,
    source: "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB168590201",
    checkedAt: "2026-10-19",
    replaces: "osm-node-3859163057",
    positionSource: "OpenStreetMap \uAE30\uC874 \uB4F1\uB85D \uC704\uCE58 \uC720\uC9C0",
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2",
      "\uC11C\uAD6C2-2"
    ]
  },
  {
    id: "busan-BSB177890201",
    name: "\uAC10\uCC9C\uBB38\uD654\uB9C8\uC744\xB7\uBD80\uC0B0\uAD50\uC721\uC5ED\uC0AC\uAD00",
    next: "\uD55C\uC0D8\uC288\uD37C",
    latitude: 35.0973041,
    longitude: 129.0106455,
    source: "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB177890201",
    checkedAt: "2026-10-19",
    replaces: "osm-node-3859163058",
    positionSource: "OpenStreetMap \uAE30\uC874 \uB4F1\uB85D \uC704\uCE58 \uC720\uC9C0",
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2",
      "\uC11C\uAD6C2-2"
    ]
  },
  {
    id: "busan-BSB177890302",
    name: "\uAC10\uCC9C2\uB3D9\uC0C8\uB9C8\uC744\uAE08\uACE0",
    next: "\uAC10\uCC9C2\uB3D9",
    latitude: 35.0924059,
    longitude: 129.00846,
    source: "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB177890302",
    checkedAt: "2026-10-19",
    replaces: null,
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2-2"
    ]
  },
  {
    id: "busan-BSB215880202",
    name: "\uAC10\uCC9C2\uB3D9\uC0C8\uB9C8\uC744\uAE08\uACE0",
    next: "\uAC10\uCC9C2\uB3D9\uC0BC\uAC70\uB9AC",
    latitude: 35.0918924,
    longitude: 129.0083461,
    source: "https://trans.minmins.kr/bus-stop.php?city=21&id=BSB215880202",
    checkedAt: "2026-10-19",
    replaces: null,
    routes: [
      "\uC0AC\uD558\uAD6C1",
      "\uC0AC\uD558\uAD6C1-1",
      "\uC11C\uAD6C2-2"
    ]
  }
];

// src/data/mapAmenities.ts
var points = [
  [3859163057, "bus_stop", 35.0972086, 129.0101505, "\uAC10\uCC9C\uBB38\uD654\uB9C8\uC744\xB7\uBD80\uC0B0\uAD50\uC721\uC5ED\uC0AC\uAD00 (\uAD6C\uAC10 \uBC29\uBA74)"],
  [3859163058, "bus_stop", 35.0973041, 129.0106455, "\uAC10\uCC9C\uBB38\uD654\uB9C8\uC744\xB7\uBD80\uC0B0\uAD50\uC721\uC5ED\uC0AC\uAD00 (\uD55C\uC0D8\uC288\uD37C \uBC29\uBA74)"],
  [4473495859, "bus_stop", 35.1000425, 129.0159166],
  [5006392764, "bus_stop", 35.0878391, 129.0041471, "\uAC10\uCC9C1\uB3D9\uC8FC\uBBFC\uC13C\uD130\xB7\uBD80\uC0B0\uCC9C\uC5F0\uAC00\uC2A4\uBC1C\uC804\uC18C"],
  [6924043187, "toilets", 35.0985138, 129.0091825],
  [6924087486, "toilets", 35.0977265, 129.0105011],
  [6924087487, "toilets", 35.0985277, 129.0100606],
  [9657838805, "bus_stop", 35.0984172, 129.0120983],
  [9657908525, "toilets", 35.0996994, 129.0122466],
  [11166195005, "toilets", 35.0879178, 129.015572],
  [11252131056, "bus_stop", 35.1012812, 129.0115548],
  [11252131057, "bus_stop", 35.1014154, 129.0116005],
  [11853831032, "toilets", 35.0972918, 129.0094237],
  [11853836253, "toilets", 35.0936128, 129.0026825],
  [12878495601, "toilets", 35.0967595, 129.0081532],
  [13075407401, "toilets", 35.0943191, 129.0080254],
  [13509548714, "toilets", 35.0976417, 129.0083769]
];
var toiletCount = 0;
var busCount = 0;
var osmAmenities = points.map(([id, category, latitude, longitude, mappedName]) => ({
  id: `osm-node-${id}`,
  name: mappedName ?? (category === "toilets" ? `\uD654\uC7A5\uC2E4 \uC704\uCE58 ${++toiletCount}` : `\uBC84\uC2A4 \uC815\uB958\uC7A5 \uC704\uCE58 ${++busCount}`),
  category,
  latitude,
  longitude,
  description: id === 3859163057 ? "\uCE74\uCE74\uC624 \uB85C\uB4DC\uBDF0(2025\uB144 11\uC6D4)\uB97C \uCC38\uACE0\uD55C \uC815\uB958\uC7A5 \uC258\uD130 3D \uC2DC\uC548 \xB7 \uD06C\uAE30\uC640 \uC815\uD655\uD55C \uC704\uCE58\uB294 \uD604\uC7A5 \uD655\uC778 \uC804" : category === "toilets" ? "OpenStreetMap \uC704\uCE58 \uC790\uB8CC \xB7 \uAC1C\uBC29 \uC5EC\uBD80\uC640 \uC6B4\uC601\uC2DC\uAC04 \uD655\uC778 \uC804" : "OpenStreetMap \uC704\uCE58 \uC790\uB8CC \xB7 \uC815\uB958\uC7A5 \uBC88\uD638\uC640 \uC6B4\uD589 \uB178\uC120 \uD655\uC778 \uC804"
}));
var REGISTERED_BUS_STOPS = gamcheon_bus_stops_default.map((stop) => ({
  id: stop.replaces ?? stop.id,
  name: `${stop.name} (${stop.next} \uBC29\uBA74)`,
  category: "bus_stop",
  latitude: stop.latitude,
  longitude: stop.longitude,
  description: `\uB9C8\uC744\uBC84\uC2A4 ${stop.routes.join(" \xB7 ")} \xB7 \uB2E4\uC74C \uC815\uB958\uC7A5: ${stop.next} \xB7 ${stop.checkedAt} \uC790\uB8CC \uD655\uC778`
}));
var MAP_AMENITIES = [
  ...osmAmenities.filter((place) => !REGISTERED_BUS_STOPS.some((stop) => stop.id === place.id)),
  ...REGISTERED_BUS_STOPS
];

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

// server/index.ts
var routes = [
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
  ["POST", /^\/api\/admin\/map-images$/, true, (request, env) => uploadPhoto(request, env)]
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

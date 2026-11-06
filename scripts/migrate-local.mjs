// 로컬 개발 DB에 마이그레이션을 적용합니다. 운영 DB에는 닿지 않습니다.
//
// 개발 서버(@cloudflare/vite-plugin)는 자기 전용 wrangler와 Workers 런타임을 씁니다. 프로젝트의 wrangler가 더 새 버전이면
// 그 런타임이 쓴 .wrangler/state를 개발 서버의 옛 런타임이 읽지 못해 std::terminate로 죽습니다. 그래서 개발 서버와 같은
// wrangler로 적용합니다. 이미 죽는 상태라면 .wrangler/state를 다른 이름으로 옮긴 뒤 이 명령을 다시 실행하세요.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// 플러그인이 전용 wrangler를 갖고 있으면 그것을, 버전이 같아 합쳐졌으면 프로젝트의 것을 씁니다.
const candidates = ["node_modules/@cloudflare/vite-plugin/node_modules/wrangler/bin/wrangler.js", "node_modules/wrangler/bin/wrangler.js"];
const wrangler = candidates.map((path) => join(root, path)).find((path) => existsSync(path));
if (!wrangler) throw new Error("wrangler를 찾지 못했습니다. npm install을 먼저 실행해 주세요.");
const { status } = spawnSync(
  process.execPath,
  [wrangler, "d1", "migrations", "apply", "gamcheon-artist-map-apply-db", "--local"],
  { cwd: root, stdio: "inherit", env: { ...process.env, CI: "1" } },
);
process.exit(status ?? 1);

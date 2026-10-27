import { env } from "cloudflare:workers";
import { ACTIVE_APPLICATION_INDEX_SQL } from "./application-schema";

export async function ensureApplicationsTable() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS artist_applications (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL DEFAULT '',
    artist_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'received',
    payload_json TEXT NOT NULL,
    image_keys_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_artist_applications_account ON artist_applications (account_id)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_artist_applications_status ON artist_applications (status)").run();
  await env.DB.prepare(ACTIVE_APPLICATION_INDEX_SQL).run();
}

// 계정 없이 접수된 옛 신청서(account_id = '')를 로그인 계정에 자동으로 붙이던 linkLegacyApplication은 제거했습니다.
// 가입 시 입력하는 이름·전화·이메일만 일치하면 타인의 신청서가 연결되는 구조였습니다. 남은 옛 신청서는 관리자가 직접 연결합니다.

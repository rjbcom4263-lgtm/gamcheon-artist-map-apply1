-- 감천 작가 지도 홈페이지 D1 스키마.
-- 예전에는 각 라우트가 요청마다 CREATE TABLE IF NOT EXISTS를 실행했습니다. 그 문장을 그대로 모은 것이라
-- 이미 운영 중인 DB에도 안전하게 적용됩니다(모두 IF NOT EXISTS).
-- 적용: npm run db:migrate (운영) / npm run db:migrate:local (로컬 개발). 배포 스크립트도 배포 전에 적용합니다.
-- 지도 API(app/map/generated)가 쓰는 map_places·map_alleys·map_building_edits·gps_trails는 art-map 저장소가 관리합니다.

-- 작가 신청서 (app/api/applications/**, app/artist/**)
CREATE TABLE IF NOT EXISTS artist_applications (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL DEFAULT '',
  artist_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'received',
  payload_json TEXT NOT NULL,
  image_keys_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_artist_applications_account ON artist_applications (account_id);
CREATE INDEX IF NOT EXISTS idx_artist_applications_status ON artist_applications (status);
-- 계정 하나에 진행 중인 신청서는 하나만
CREATE UNIQUE INDEX IF NOT EXISTS idx_artist_applications_one_active_account
  ON artist_applications (account_id)
  WHERE account_id != '' AND status IN ('draft', 'received', 'reviewing', 'hold', 'approved');

-- 계정 (app/admin/admin-auth.ts)
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY NOT NULL,
  login_id TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'artist')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'deleted')),
  display_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_accounts_role ON accounts (role);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts (status);

-- 가입 시 개인정보 동의 기록
CREATE TABLE IF NOT EXISTS account_privacy_consents (
  account_id TEXT PRIMARY KEY NOT NULL,
  version TEXT NOT NULL,
  required_accepted_at TEXT NOT NULL,
  email_accepted_at TEXT
);

-- 소셜 로그인 연결 (app/api/auth/**)
CREATE TABLE IF NOT EXISTS social_accounts (
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (provider, provider_user_id)
);
CREATE INDEX IF NOT EXISTS idx_social_accounts_account ON social_accounts (account_id);

-- 작품 해설 (app/work-guides, app/api/**/work-guides)
CREATE TABLE IF NOT EXISTS artwork_guides (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  application_id TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  pending_title TEXT,
  pending_description TEXT,
  pending_image_key TEXT,
  published_title TEXT,
  published_description TEXT,
  published_image_key TEXT,
  translations_json TEXT NOT NULL DEFAULT '{}',
  submitted_at TEXT,
  published_at TEXT,
  pending_revision INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_artwork_guides_account ON artwork_guides (account_id);
CREATE INDEX IF NOT EXISTS idx_artwork_guides_submitted ON artwork_guides (submitted_at);

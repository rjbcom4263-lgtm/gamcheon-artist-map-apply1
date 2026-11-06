-- 로그인·가입 시도 횟수 (app/lib/auth-attempts.ts)
-- 비밀번호 대입을 막으려고 시간 창 안의 횟수만 셉니다. IP와 아이디는 서버 비밀값을 섞은 해시로만 남기고, 시간 창이 끝나면 지웁니다.
CREATE TABLE IF NOT EXISTS auth_attempts (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_ends_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_window ON auth_attempts (window_ends_at);

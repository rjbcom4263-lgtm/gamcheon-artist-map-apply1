-- 세션 무효화용 버전. 세션 토큰에 발급 당시 값을 넣고, 요청마다 DB 값과 비교합니다.
-- 계정 정지·삭제, 비밀번호 변경·초기화, 관리자 승격 때 1 올리면 그 계정의 기존 세션이 모두 끊깁니다.
ALTER TABLE accounts ADD COLUMN session_version INTEGER NOT NULL DEFAULT 1;

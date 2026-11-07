import { cleanText } from "../lib/application.ts";
import { isReservedLoginId, passwordProblem } from "../lib/account-rules.ts";
import type { ApiContext } from "../lib/api-context";
import { SIGNUP_PRIVACY_VERSION } from "../signup/privacy-consent.ts";
import type { AccountRole, SessionUser } from "./admin-auth";
import { hashPassword, safeEqual, sha256Hex, verifyPassword } from "./password-hash.ts";

// 아이디·비밀번호 확인과 가입입니다. DB를 넘겨받아 Node 테스트에서 그대로 돌릴 수 있습니다.
type Db = ApiContext["DB"];

export const ROLES = new Set(["admin", "artist"]);
/** 환경변수(ADMIN_USERNAME/ADMIN_PASSWORD_HASH)로 로그인한 초기 관리자. DB에 활성 관리자 계정이 생기면 이 경로는 닫힙니다. */
export const LEGACY_ADMIN_ID = "legacy-admin";

async function verifyAdminCredentials(username: string, password: string) {
  return safeEqual(username, process.env.ADMIN_USERNAME || "") && safeEqual(await sha256Hex(password), process.env.ADMIN_PASSWORD_HASH || "");
}
async function hasActiveAdminAccount(db: Db) {
  const row = await db.prepare("SELECT 1 AS ok FROM accounts WHERE role = 'admin' AND status = 'active' LIMIT 1").first<{ ok: number }>();
  return !!row;
}

export type SignupInput = { loginId?: string; password?: string; displayName?: string; phone?: string; email?: string; consentRequired?: unknown; consentEmail?: unknown; privacyVersion?: unknown };

export async function createArtistAccount(db: Db, input: SignupInput) {
  if (input.consentRequired !== true || input.privacyVersion !== SIGNUP_PRIVACY_VERSION) return { error: "현재 개인정보 안내를 확인하고 필수 항목에 동의해 주세요.", status: 400 };
  const loginId = cleanText(input.loginId, 150);
  const password = typeof input.password === "string" ? input.password : "";
  const displayName = cleanText(input.displayName, 100);
  const phone = cleanText(input.phone, 30);
  const email = cleanText(input.email, 150);
  if (!loginId || !password || !displayName || !phone) return { error: "필수 정보를 모두 입력해주세요.", status: 400 };
  if (isReservedLoginId(loginId)) return { error: "google_, kakao_, naver_로 시작하는 아이디는 소셜 로그인용이라 사용할 수 없습니다.", status: 400 };
  const problem = passwordProblem(password);
  if (problem) return { error: problem, status: 400 };
  if (email && input.consentEmail !== true) return { error: "이메일 수집·이용에 동의하거나 이메일을 비워 주세요.", status: 400 };
  const id = `ACC-${crypto.randomUUID()}`;
  const acceptedAt = new Date().toISOString();
  try {
    await db.batch([
      db.prepare("INSERT INTO accounts (id, login_id, password_hash, role, status, display_name, phone, email) VALUES (?, ?, ?, 'artist', 'pending', ?, ?, ?)")
        .bind(id, loginId, await hashPassword(password), displayName, phone, email),
      db.prepare("INSERT INTO account_privacy_consents (account_id, version, required_accepted_at, email_accepted_at) VALUES (?, ?, ?, ?)")
        .bind(id, SIGNUP_PRIVACY_VERSION, acceptedAt, input.consentEmail === true ? acceptedAt : null),
    ]);
    const account: SessionUser = { accountId: id, loginId, role: "artist", displayName, sessionVersion: 1 };
    return { account };
  } catch (error) {
    if (String(error).includes("UNIQUE constraint failed: accounts.login_id")) return { error: "이미 사용 중인 아이디입니다.", status: 409 };
    return { error: "회원가입을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.", status: 500 };
  }
}

export async function verifyCredentials(db: Db, loginId: string, password: string): Promise<SessionUser | null> {
  const account = await db.prepare("SELECT id, login_id, password_hash, role, status, display_name, session_version FROM accounts WHERE login_id = ?")
    .bind(loginId).first<{ id: string; login_id: string; password_hash: string; role: string; status: string; display_name: string; session_version: number }>();
  if (account && account.status !== "deleted" && account.status !== "suspended" && ROLES.has(account.role)) {
    const verified = await verifyPassword(password, account.password_hash);
    if (verified.ok) {
      // 옛 SHA-256 해시로 저장된 계정은 로그인에 성공한 이 시점에 새 형식으로 바꿔 둡니다.
      if (verified.needsRehash) {
        await db.prepare("UPDATE accounts SET password_hash = ?, last_login_at = CURRENT_TIMESTAMP WHERE id = ? AND password_hash = ?")
          .bind(await hashPassword(password), account.id, account.password_hash).run();
      } else {
        await db.prepare("UPDATE accounts SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?").bind(account.id).run();
      }
      return { accountId: account.id, loginId: account.login_id, role: account.role as AccountRole, displayName: account.display_name || account.login_id, sessionVersion: account.session_version };
    }
  }
  // 환경변수 관리자는 DB에 활성 관리자 계정이 하나도 없을 때만 받습니다. 계정을 승격한 뒤에는 ADMIN_* 비밀값을 지워도 됩니다.
  if (!account && !(await hasActiveAdminAccount(db)) && await verifyAdminCredentials(loginId, password)) {
    return { accountId: LEGACY_ADMIN_ID, loginId, role: "admin", displayName: loginId, sessionVersion: 0 };
  }
  return null;
}

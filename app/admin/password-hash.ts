// 비밀번호 해시와 비교, 임시 비밀번호 생성. 외부 의존성이 없어 Node 테스트(tests/password-hash.test.mts)에서 그대로 불러 씁니다.
//
// 계정 비밀번호는 사용자별 솔트를 섞은 PBKDF2-SHA256으로 저장합니다.
// 저장 형식: pbkdf2-sha256$<반복 횟수>$<솔트 base64url>$<해시 base64url>
// Cloudflare Workers의 WebCrypto는 PBKDF2 반복 횟수를 100,000회까지만 허용합니다.
const PASSWORD_HASH_PREFIX = "pbkdf2-sha256";
export const PASSWORD_HASH_ITERATIONS = 100_000;
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_HASH_BITS = 256;

export function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}
export function base64UrlToBytes(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}
function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
/** 옛 비밀번호 형식(솔트 없는 SHA-256 hex)과 환경변수 ADMIN_PASSWORD_HASH 비교에만 씁니다. */
export async function sha256Hex(value: string) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}
/** 길이가 같을 때 상수 시간으로 비교합니다. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let different = 0;
  for (let i = 0; i < a.length; i++) different |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return different === 0;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, PASSWORD_HASH_BITS);
  return bytesToBase64Url(new Uint8Array(bits));
}
export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
  return `${PASSWORD_HASH_PREFIX}$${PASSWORD_HASH_ITERATIONS}$${bytesToBase64Url(salt)}$${await pbkdf2(password, salt, PASSWORD_HASH_ITERATIONS)}`;
}
/** 저장된 해시와 비교합니다. 옛 형식(솔트 없는 SHA-256 hex)도 받아들이되 needsRehash로 표시해 로그인 시 새 형식으로 바꿉니다. */
export async function verifyPassword(password: string, stored: string): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (stored.startsWith(`${PASSWORD_HASH_PREFIX}$`)) {
    const [, iterationsText, saltText, hashText] = stored.split("$");
    const iterations = Number(iterationsText);
    if (!Number.isInteger(iterations) || iterations <= 0 || !saltText || !hashText) return { ok: false, needsRehash: false };
    try {
      const derived = await pbkdf2(password, base64UrlToBytes(saltText), iterations);
      return { ok: safeEqual(derived, hashText), needsRehash: iterations !== PASSWORD_HASH_ITERATIONS };
    } catch {
      return { ok: false, needsRehash: false };
    }
  }
  return { ok: safeEqual(await sha256Hex(password), stored), needsRehash: true };
}
/** 관리자가 초기화할 때 쓰는 임시 비밀번호. 헷갈리는 글자(0/O, 1/l/I)를 뺀 글자 집합에서 12자를 뽑습니다. */
export function generateTemporaryPassword(length = 12) {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
}

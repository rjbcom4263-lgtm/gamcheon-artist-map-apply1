// 지도 앱 편집 화면에 넘길 편집 허가증을 만듭니다(운영자 로그인을 확인한 뒤에만 부름).
// "base64url(내용).base64url(HMAC-SHA256(MAP_EDIT_SECRET, 내용))" 형식이고, 지도 앱 server/auth.ts의
// verifyEditToken이 같은 비밀값으로 확인합니다. 비밀값은 지도 앱의 npm run link:homepage로 두 서버에 함께 넣습니다.
const AUDIENCE = "gamcheon-map-studio";
const TOKEN_SECONDS = 60 * 60 * 8;

const base64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
};

export async function createMapEditToken(loginId: string) {
  const secret = process.env.MAP_EDIT_SECRET || "";
  if (secret.length < 32) return null;
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({ aud: AUDIENCE, sub: loginId, exp: Math.floor(Date.now() / 1000) + TOKEN_SECONDS })));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  return `${payload}.${base64Url(signature)}`;
}

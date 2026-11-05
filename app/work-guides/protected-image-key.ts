// 워터마크를 넣은 사본의 저장 위치입니다. 만들 때(protected-image.ts)와 지울 때 같은 규칙을 씁니다.
// 작가 이름이 바뀌면 다른 위치가 되므로, 이름이 바뀌기 전에 만든 사본은 이 규칙으로 찾을 수 없습니다.
export async function protectedImageKey(key: string, artistName: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${key}:${artistName}`));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `protected-images/v3/${hash}.webp`;
}

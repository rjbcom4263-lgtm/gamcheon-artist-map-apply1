export function safeNextPath(value: unknown, fallback = "/") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\r\n]/.test(value)) return fallback;
  return value;
}

export function pathWithNext(path: string, nextPath: string) {
  return `${path}?next=${encodeURIComponent(nextPath)}`;
}

export const AUTH_NEXT_COOKIE = "gamcheon_auth_next";

export function safeNextCookie(value: unknown, fallback = "/") {
  if (typeof value !== "string") return fallback;
  try {
    return safeNextPath(decodeURIComponent(value), fallback);
  } catch {
    return fallback;
  }
}

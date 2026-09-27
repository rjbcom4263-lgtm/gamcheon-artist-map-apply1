import { adminCookie, createSession, verifyCredentials } from "../../../admin/admin-auth";
export const runtime = "edge";
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { username?: string; password?: string };
  const user = body.username && body.password ? await verifyCredentials(body.username, body.password) : null;
  if (!user || user.role !== "admin") return Response.json({ error: "로그인 정보가 올바르지 않습니다." }, { status: 401 });
  const session = await createSession(user);
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json", "set-cookie": `${adminCookie.name}=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${adminCookie.maxAge}` } });
}

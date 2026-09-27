import { adminCookie, createArtistAccount, createSession } from "../../../admin/admin-auth";

export const runtime = "edge";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { loginId?: string; password?: string; displayName?: string; phone?: string; email?: string };
  const result = await createArtistAccount(body);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  const session = await createSession({ accountId: result.account.id, loginId: result.account.loginId, role: "artist", displayName: result.account.displayName });
  return new Response(JSON.stringify({ ok: true, role: "artist", redirectTo: "/artist" }), {
    headers: { "content-type": "application/json", "set-cookie": `${adminCookie.name}=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${adminCookie.maxAge}` },
  });
}

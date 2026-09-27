import CloneHome from "./CloneHome";
import { env } from "cloudflare:workers";
import { requireSession } from "../admin/admin-auth";
import { statLabels } from "./content";

type ApplicationRow = { artist_name: string; phone: string; email: string; status: string; payload_json: string };
type ApplicationPayload = { values?: Record<string, string | boolean>; works?: unknown[] };

function parsePayload(value: string): ApplicationPayload {
  try { return JSON.parse(value) as ApplicationPayload; } catch { return {}; }
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function getHomeStats() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS artist_applications (
    id TEXT PRIMARY KEY, artist_name TEXT NOT NULL, phone TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'received',
    payload_json TEXT NOT NULL, image_keys_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  const result = await env.DB.prepare("SELECT artist_name, phone, email, status, payload_json FROM artist_applications").all<ApplicationRow>();
  const rows = result.results || [];
  const approved = rows.filter((row) => row.status === "approved");
  const artistKeys = new Set<string>();
  const spaces = new Set<string>();
  let works = 0;
  for (const row of approved) {
    const payload = parsePayload(row.payload_json);
    const artistKey = text(row.email) || text(row.phone) || text(row.artist_name);
    if (artistKey) artistKeys.add(artistKey.toLowerCase());
    works += Array.isArray(payload.works) ? payload.works.length : 0;
    const values = payload.values || {};
    const space = text(values.studioName) || text(values.address);
    if (space) spaces.add(space.toLowerCase());
  }
  const preparingProjects = rows.filter((row) => ["received", "reviewing", "hold"].includes(row.status)).length;
  return [
    [statLabels[0][0], artistKeys.size, statLabels[0][1]],
    [statLabels[1][0], works, statLabels[1][1]],
    [statLabels[2][0], spaces.size, statLabels[2][1]],
    [statLabels[3][0], preparingProjects, statLabels[3][1]],
  ] as [string, number, string][];
}

export default async function LandingSamplePage() {
  const user = await requireSession();
  const stats = await getHomeStats();
  return <CloneHome user={user ? { role: user.role } : null} stats={stats} />;
}

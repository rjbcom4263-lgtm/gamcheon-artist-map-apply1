import { env } from "cloudflare:workers";
import { ACTIVE_APPLICATION_INDEX_SQL } from "./application-schema";

type AccountIdentity = { id: string; displayName: string; phone?: string | null; email?: string | null };

export async function ensureApplicationsTable() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS artist_applications (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL DEFAULT '',
    artist_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'received',
    payload_json TEXT NOT NULL,
    image_keys_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_artist_applications_account ON artist_applications (account_id)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_artist_applications_status ON artist_applications (status)").run();
  await env.DB.prepare(ACTIVE_APPLICATION_INDEX_SQL).run();
}

export async function linkLegacyApplication(account: AccountIdentity) {
  const displayName = account.displayName.trim();
  const phone = account.phone?.trim() || "";
  const email = account.email?.trim().toLowerCase() || "";
  if (!displayName && !phone && !email) return;
  const candidates = await env.DB.prepare(`SELECT id FROM artist_applications
    WHERE account_id = '' AND status IN ('draft', 'received', 'reviewing', 'hold', 'approved')
      AND ((? != '' AND phone = ?) OR (? != '' AND lower(email) = ?) OR (? != '' AND artist_name = ?))
    ORDER BY created_at DESC LIMIT 2`)
    .bind(phone, phone, email, email, displayName, displayName).all<{ id: string }>();
  if (candidates.results?.length !== 1) return;
  await env.DB.prepare("UPDATE artist_applications SET account_id = ? WHERE id = ? AND account_id = ''")
    .bind(account.id, candidates.results[0].id).run();
}

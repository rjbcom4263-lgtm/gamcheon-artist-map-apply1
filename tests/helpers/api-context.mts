import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { ApiContext } from "../../app/lib/api-context.ts";
import type { SessionUser } from "../../app/admin/admin-auth.ts";

// API 처리 함수를 시험할 때 쓰는 ApiContext입니다. DB는 D1과 같은 SQLite(메모리)에 실제 마이그레이션을 올려
// SQL과 표를 그대로 돌리고, R2는 쓰는 기능만 메모리로 흉내 냅니다.
function sqliteD1() {
  const db = new DatabaseSync(":memory:");
  for (const file of readdirSync("migrations").sort()) db.exec(readFileSync(`migrations/${file}`, "utf8"));
  const statement = (sql: string, args: unknown[] = []) => ({
    sql,
    args,
    bind: (...next: unknown[]) => statement(sql, next),
    first: async () => db.prepare(sql).get(...(args as never[])) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...(args as never[])) }),
    run: async () => {
      const { changes } = db.prepare(sql).run(...(args as never[]));
      return { meta: { changes: Number(changes) } };
    },
  });
  return {
    prepare: (sql: string) => statement(sql),
    // D1의 batch처럼 전부 성공하거나 전부 되돌립니다.
    batch: async (statements: ReturnType<typeof statement>[]) => {
      db.exec("BEGIN");
      try {
        const results = [];
        for (const item of statements) results.push(await item.run());
        db.exec("COMMIT");
        return results;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

function memoryBucket() {
  const objects = new Map<string, unknown>();
  const metadata = new Map<string, unknown>();
  return {
    keys: () => [...objects.keys()],
    async put(key: string, body: unknown, options?: unknown) { objects.set(key, body); metadata.set(key, options); },
    async get(key: string) { return objects.has(key) ? { body: objects.get(key) } : null; },
    async head(key: string) { return objects.has(key) ? { ...(metadata.get(key) as object) } : null; },
    async delete(keys: string | string[]) { for (const key of [keys].flat()) { objects.delete(key); metadata.delete(key); } },
    // 2개씩 나눠 돌려줘 이어 읽기(cursor)까지 함께 시험합니다.
    async list({ prefix, cursor }: { prefix: string; cursor?: string }) {
      const all = [...objects.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key }));
      const start = Number(cursor ?? 0);
      const end = start + 2;
      return { objects: all.slice(start, end), truncated: end < all.length, cursor: String(end) };
    },
  };
}

export const user = (accountId: string, role: "admin" | "artist" = "artist"): SessionUser =>
  ({ accountId, role, loginId: accountId, displayName: accountId, sessionVersion: 1 });

/** 같은 저장소를 보는 서버 하나를 만듭니다. as(사용자)로 요청을 보낼 사람을 고릅니다. */
export function apiServer() {
  const DB = sqliteD1();
  const BUCKET = memoryBucket();
  const as = (viewer: SessionUser | null): ApiContext =>
    ({ DB, BUCKET, session: async () => viewer }) as unknown as ApiContext;

  const addApplication = async (id: string, values: { accountId?: string; status?: string; payload?: object; images?: object[]; name?: string } = {}) => {
    await DB.prepare("INSERT INTO artist_applications (id, account_id, artist_name, phone, email, status, payload_json, image_keys_json) VALUES (?, ?, ?, '', '', ?, ?, ?)")
      .bind(id, values.accountId ?? "owner", values.name ?? "작가", values.status ?? "approved", JSON.stringify(values.payload ?? {}), JSON.stringify(values.images ?? [])).run();
  };
  const addGuide = async (id: string, values: { applicationId: string; accountId?: string; published?: boolean; artistName?: string; publishedKey?: string; pendingKey?: string; publishedDescription?: string | null; publishedAt?: string }) => {
    const published = values.published !== false;
    const description = values.publishedDescription === undefined ? (published ? "설명" : null) : values.publishedDescription;
    await DB.prepare("INSERT INTO artwork_guides (id, account_id, application_id, artist_name, published_title, published_description, published_image_key, pending_image_key, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, values.accountId ?? "owner", values.applicationId, values.artistName ?? "작가", published ? `작품 ${id}` : null, description, values.publishedKey ?? (published ? `work-guides/${id}/image.webp` : null), values.pendingKey ?? null, values.publishedAt ?? null).run();
  };
  const addAccount = async (id: string, status = "active") => {
    await DB.prepare("INSERT INTO accounts (id, login_id, password_hash, role, status) VALUES (?, ?, 'test-only', 'artist', ?)").bind(id, id, status).run();
  };
  const setApplicationStatus = async (id: string, status: string) => {
    await DB.prepare("UPDATE artist_applications SET status = ? WHERE id = ?").bind(status, id).run();
  };
  const setAccountStatus = async (id: string, status: string) => {
    await DB.prepare("UPDATE accounts SET status = ? WHERE id = ?").bind(status, id).run();
  };
  const guideIds = async () => ((await DB.prepare("SELECT id FROM artwork_guides ORDER BY id").all()).results as Array<{ id: string }>).map((row) => row.id);
  const application = (id: string) => DB.prepare("SELECT * FROM artist_applications WHERE id = ?").bind(id).first() as Promise<Record<string, string> | null>;
  const stats = async () => (await DB.prepare("SELECT application_id, day, kind, target, count FROM artist_daily_stats ORDER BY application_id, kind, target").all()).results as Array<Record<string, string | number>>;
  const addStat = async (applicationId: string, kind = "view", target = "", count = 3) => {
    await DB.prepare("INSERT INTO artist_daily_stats (application_id, day, kind, target, count) VALUES (?, '2026-11-05', ?, ?, ?)").bind(applicationId, kind, target, count).run();
  };
  return { as, DB, BUCKET, addApplication, addGuide, addAccount, setApplicationStatus, setAccountStatus, guideIds, addStat, application, stats };
}

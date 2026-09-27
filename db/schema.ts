import { sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const applications = sqliteTable("artist_applications", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().default(""),
  artistName: text("artist_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull().default(""),
  status: text("status").notNull().default("received"),
  payloadJson: text("payload_json").notNull(),
  imageKeysJson: text("image_keys_json").notNull().default("[]"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

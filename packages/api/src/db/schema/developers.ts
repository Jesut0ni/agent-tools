import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

export const developers = sqliteTable(
  "developers",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    email: text("email").notNull(),
    apiKeyHash: text("api_key_hash").notNull(),
    apiKeyPreview: text("api_key_preview").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    emailIdx: uniqueIndex("developers_email_unique").on(t.email),
    keyIdx: uniqueIndex("developers_api_key_hash_unique").on(t.apiKeyHash),
  })
);

export type DeveloperRow = typeof developers.$inferSelect;

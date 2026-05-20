import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

export const developers = sqliteTable(
  "developers",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    email: text("email").notNull(),
    apiKeyHash: text("api_key_hash"),
    apiKeyPreview: text("api_key_preview"),
    verified: integer("verified", { mode: "boolean" }).notNull().default(false),
    verificationToken: text("verification_token"),
    suspended: integer("suspended", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    emailIdx: uniqueIndex("developers_email_unique").on(t.email),
    keyIdx: uniqueIndex("developers_api_key_hash_unique").on(t.apiKeyHash),
    verifyIdx: index("developers_verification_token_idx").on(t.verificationToken),
  })
);

export type DeveloperRow = typeof developers.$inferSelect;

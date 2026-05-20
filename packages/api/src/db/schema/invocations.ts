import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

export const invocations = sqliteTable(
  "invocations",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    toolId: text("tool_id").notNull(),
    toolSlug: text("tool_slug").notNull(),
    toolOwnerId: text("tool_owner_id"),
    callerKind: text("caller_kind", { enum: ["developer", "agent", "anonymous"] }).notNull(),
    callerId: text("caller_id"),
    status: integer("status").notNull(),
    durationMs: integer("duration_ms").notNull(),
    errorMessage: text("error_message"),
    calledAt: integer("called_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    ownerIdx: index("invocations_owner_idx").on(t.toolOwnerId, t.calledAt),
    callerIdx: index("invocations_caller_idx").on(t.callerId, t.calledAt),
    toolIdx: index("invocations_tool_idx").on(t.toolId, t.calledAt),
  })
);

export type InvocationRow = typeof invocations.$inferSelect;

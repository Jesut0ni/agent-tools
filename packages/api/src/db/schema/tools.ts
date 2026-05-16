import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

export const tools = sqliteTable(
  "tools",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    ownerId: text("owner_id"),
    visibility: text("visibility", { enum: ["public", "private"] })
      .notNull()
      .default("public"),
    latestVersion: text("latest_version"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    slugIdx: uniqueIndex("tools_slug_unique").on(t.slug),
    visIdx: index("tools_visibility_idx").on(t.visibility),
  })
);

export const toolVersions = sqliteTable(
  "tool_versions",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    toolId: text("tool_id")
      .notNull()
      .references(() => tools.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    spec: text("spec", { mode: "json" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    versionIdx: uniqueIndex("tool_versions_tool_version_unique").on(t.toolId, t.version),
  })
);

export type ToolRow = typeof tools.$inferSelect;
export type ToolVersionRow = typeof toolVersions.$inferSelect;

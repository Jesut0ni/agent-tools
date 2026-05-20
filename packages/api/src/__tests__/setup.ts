import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { beforeAll, beforeEach } from "vitest";

// Set env BEFORE any module imports the DB client.
const TEST_DB = path.resolve(process.cwd(), "./.test.db");
process.env.NODE_ENV = "test";
process.env.DATABASE_PATH = TEST_DB;
process.env.LOG_LEVEL = "fatal";
process.env.RATE_LIMIT_READ_PER_MINUTE = "100000";
process.env.RATE_LIMIT_WRITE_PER_MINUTE = "100000";
process.env.RATE_LIMIT_CALL_PER_MINUTE = "100000";

// Fresh DB file for each run
if (existsSync(TEST_DB)) unlinkSync(TEST_DB);

beforeAll(async () => {
  // Dynamic imports so env is set first.
  const { pool } = await import("../db/client.js");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const migrationDir = path.resolve(process.cwd(), "./src/db/migrations");
  migrate(drizzle(pool), { migrationsFolder: migrationDir });
});

beforeEach(async () => {
  const { db } = await import("../db/client.js");
  const { tools, toolVersions } = await import("../db/schema/tools.js");
  const { developers } = await import("../db/schema/developers.js");
  // Order matters: versions before tools (FK), then developers
  await db.delete(toolVersions);
  await db.delete(tools);
  await db.delete(developers);
});

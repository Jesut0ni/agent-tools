import { drizzle } from "drizzle-orm/better-sqlite3";
import Database, { type Database as DatabaseType } from "better-sqlite3";
import path from "node:path";
import * as schema from "./schema/index.js";

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "agent-tools.db");
const sqlite = new Database(dbPath);

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export const pool: DatabaseType = sqlite;

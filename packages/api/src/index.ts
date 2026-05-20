import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createApp } from "./app.js";
import { logger } from "./lib/logger.js";
import { pool } from "./db/client.js";
import { getEnv } from "./env.js";

const env = getEnv();

if (env.NODE_ENV === "production") {
  if (env.AGENTGATE_JWT_SECRET.startsWith("dev-secret-")) {
    logger.fatal("Refusing to boot in production with the default AGENTGATE_JWT_SECRET");
    process.exit(1);
  }
  if (env.CORS_ORIGINS.length === 0 || env.CORS_ORIGINS.includes("http://localhost:3000")) {
    logger.warn(
      "CORS_ORIGINS still includes the localhost default; set it to your production web origin"
    );
  }
}

// Auto-migrate on boot. Drizzle tracks applied migrations in __drizzle_migrations,
// so this is a no-op on subsequent starts.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../src/db/migrations");
const migrationsFolderFallback = path.resolve(__dirname, "./db/migrations");
try {
  migrate(drizzle(pool), { migrationsFolder });
} catch (err) {
  // Production runtime layout (dist/) won't have ../src; fall back to ./db/migrations
  if ((err as NodeJS.ErrnoException).code === "ENOENT") {
    migrate(drizzle(pool), { migrationsFolder: migrationsFolderFallback });
  } else {
    throw err;
  }
}
logger.info("Database migrations applied");

const app = createApp();
const port = env.API_PORT;
logger.info(`agent-tools API starting on port ${port}`);

const { serve } = await import("@hono/node-server");
serve({ fetch: app.fetch, port });

function shutdown() {
  logger.info("Shutting down...");
  pool.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

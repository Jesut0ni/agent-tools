import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { logger as honoLogger } from "hono/logger";
import { errorHandler } from "./middleware/error-handler.js";
import { logger } from "./lib/logger.js";
import { pool } from "./db/client.js";
import { getEnv } from "./env.js";

import healthRoutes from "./routes/health.js";
import toolRoutes from "./routes/tools.js";

const app = new Hono();

app.use("*", cors());
app.use("*", requestId());
app.use("*", honoLogger());

app.route("/api/v1/health", healthRoutes);
app.route("/api/v1/tools", toolRoutes);

app.get("/", (c) =>
  c.json({
    name: "agent-tools",
    version: "0.1.0",
    description: "An open registry of machine-readable tools for AI agents.",
    docs: "/api/v1/tools",
    health: "/api/v1/health",
  })
);

app.onError(errorHandler);

const port = getEnv().API_PORT;
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

export default app;

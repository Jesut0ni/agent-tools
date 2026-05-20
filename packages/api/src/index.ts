import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { logger as honoLogger } from "hono/logger";
import { errorHandler } from "./middleware/error-handler.js";
import { rateLimit } from "./middleware/rate-limit.js";
import { logger } from "./lib/logger.js";
import { pool } from "./db/client.js";
import { getEnv } from "./env.js";

import healthRoutes from "./routes/health.js";
import toolRoutes from "./routes/tools.js";
import developerRoutes from "./routes/developers.js";
import mcpRoutes from "./routes/mcp.js";

const env = getEnv();
const app = new Hono();

app.use(
  "*",
  cors({
    origin: (incoming) => (env.CORS_ORIGINS.includes(incoming) ? incoming : ""),
    credentials: false,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
  })
);
app.use("*", requestId());
app.use("*", honoLogger());

app.use("/api/v1/health/*", rateLimit(env.RATE_LIMIT_READ_PER_MINUTE));

// Developers: writes (signup) stricter than reads (/me)
app.use("/api/v1/developers", async (c, next) => {
  const isWrite = c.req.method !== "GET";
  const limit = isWrite ? env.RATE_LIMIT_WRITE_PER_MINUTE : env.RATE_LIMIT_READ_PER_MINUTE;
  return rateLimit(limit)(c, next);
});
app.use("/api/v1/developers/*", async (c, next) => {
  const isWrite = c.req.method !== "GET";
  const limit = isWrite ? env.RATE_LIMIT_WRITE_PER_MINUTE : env.RATE_LIMIT_READ_PER_MINUTE;
  return rateLimit(limit)(c, next);
});

// Tool reads vs writes vs calls have separate limits
app.use("/api/v1/tools", async (c, next) => {
  const isWrite = c.req.method !== "GET";
  const limit = isWrite ? env.RATE_LIMIT_WRITE_PER_MINUTE : env.RATE_LIMIT_READ_PER_MINUTE;
  return rateLimit(limit)(c, next);
});
app.use("/api/v1/tools/*", async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (path.endsWith("/call")) {
    return rateLimit(env.RATE_LIMIT_CALL_PER_MINUTE)(c, next);
  }
  const isWrite = c.req.method !== "GET";
  const limit = isWrite ? env.RATE_LIMIT_WRITE_PER_MINUTE : env.RATE_LIMIT_READ_PER_MINUTE;
  return rateLimit(limit)(c, next);
});

// MCP: anything can carry a tools/call inside, so treat like /tools/:slug/call
app.use("/api/v1/mcp", rateLimit(env.RATE_LIMIT_CALL_PER_MINUTE));
app.use("/api/v1/mcp/*", rateLimit(env.RATE_LIMIT_CALL_PER_MINUTE));

app.route("/api/v1/health", healthRoutes);
app.route("/api/v1/tools", toolRoutes);
app.route("/api/v1/developers", developerRoutes);
app.route("/api/v1/mcp", mcpRoutes);

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

export default app;

import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { logger as honoLogger } from "hono/logger";
import { errorHandler } from "./middleware/error-handler.js";
import { rateLimit } from "./middleware/rate-limit.js";
import { getEnv } from "./env.js";

import healthRoutes from "./routes/health.js";
import toolRoutes from "./routes/tools.js";
import developerRoutes from "./routes/developers.js";
import mcpRoutes from "./routes/mcp.js";
import invocationRoutes from "./routes/invocations.js";

export function createApp() {
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
  if (process.env.NODE_ENV !== "test") {
    app.use("*", honoLogger());
  }

  app.use("/api/v1/health/*", rateLimit(env.RATE_LIMIT_READ_PER_MINUTE));

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

  app.use("/api/v1/mcp", rateLimit(env.RATE_LIMIT_CALL_PER_MINUTE));
  app.use("/api/v1/mcp/*", rateLimit(env.RATE_LIMIT_CALL_PER_MINUTE));

  app.use("/api/v1/invocations", rateLimit(env.RATE_LIMIT_READ_PER_MINUTE));
  app.use("/api/v1/invocations/*", rateLimit(env.RATE_LIMIT_READ_PER_MINUTE));

  app.route("/api/v1/health", healthRoutes);
  app.route("/api/v1/tools", toolRoutes);
  app.route("/api/v1/developers", developerRoutes);
  app.route("/api/v1/mcp", mcpRoutes);
  app.route("/api/v1/invocations", invocationRoutes);

  app.get("/", (c) =>
    c.json({
      name: "agent-tools",
      version: "0.6.0",
      description: "An open registry of machine-readable tools for AI agents.",
      docs: "/api/v1/tools",
      mcp: "/api/v1/mcp",
      health: "/api/v1/health",
    })
  );

  app.onError(errorHandler);

  return app;
}

import { Hono } from "hono";
import { pool } from "../db/client.js";

const app = new Hono();

app.get("/", (c) => {
  const checks: Record<string, string> = {};

  try {
    pool.pragma("integrity_check");
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  const healthy = Object.values(checks).every((v) => v === "ok");

  return c.json(
    { status: healthy ? "healthy" : "degraded", checks },
    healthy ? 200 : 503
  );
});

export default app;

import { createMiddleware } from "hono/factory";

/**
 * v0 auth stub. Anything in `Authorization: Bearer <token>` becomes the
 * caller identity. AgentGate-issued JWT validation lands here in v0.1.
 */
export type Caller = { id: string; raw: string } | null;

export const authMiddleware = createMiddleware<{ Variables: { caller: Caller } }>(
  async (c, next) => {
    const header = c.req.header("authorization");
    if (header?.toLowerCase().startsWith("bearer ")) {
      const raw = header.slice(7).trim();
      c.set("caller", { id: raw, raw });
    } else {
      c.set("caller", null);
    }
    await next();
  }
);

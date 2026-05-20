import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { developers, type DeveloperRow } from "../db/schema/developers.js";
import { hashApiKey, isLikelyApiKey } from "../lib/api-keys.js";

export type Caller =
  | { kind: "developer"; developer: DeveloperRow; raw: string }
  | { kind: "agent"; raw: string; claims?: Record<string, unknown> }
  | null;

/**
 * Resolves the `Authorization: Bearer <token>` header. If the token looks like
 * an agent-tools API key (`at_...`), we look up the owning developer. Otherwise
 * the bearer is kept as an opaque agent token (verified later by route handlers
 * that care, e.g. AgentGate JWT verification on tool invocation).
 */
export const authMiddleware = createMiddleware<{ Variables: { caller: Caller } }>(
  async (c, next) => {
    const header = c.req.header("authorization");
    if (!header?.toLowerCase().startsWith("bearer ")) {
      c.set("caller", null);
      return next();
    }

    const raw = header.slice(7).trim();

    if (isLikelyApiKey(raw)) {
      const dev = await db.query.developers.findFirst({
        where: eq(developers.apiKeyHash, hashApiKey(raw)),
      });
      if (dev) {
        c.set("caller", { kind: "developer", developer: dev, raw });
        return next();
      }
    }

    c.set("caller", { kind: "agent", raw });
    await next();
  }
);

export function requireDeveloper(caller: Caller): asserts caller is Extract<
  Caller,
  { kind: "developer" }
> {
  if (!caller || caller.kind !== "developer") {
    throw new HTTPException(401, {
      message: "API key required. Sign up at POST /api/v1/developers.",
    });
  }
}

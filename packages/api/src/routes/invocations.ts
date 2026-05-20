import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "../db/client.js";
import { invocations } from "../db/schema/invocations.js";
import { authMiddleware, requireDeveloper, type Caller } from "../middleware/auth.js";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
  slug: z.string().optional(),
});

type Vars = { Variables: { caller: Caller } };
const app = new Hono<Vars>();

app.use("*", authMiddleware);

function encodeCursor(date: Date, id: string): string {
  return Buffer.from(`${date.getTime()}:${id}`).toString("base64url");
}
function decodeCursor(cursor: string): { ts: number; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const [ts, id] = decoded.split(":");
    if (!ts || !id) return null;
    return { ts: Number(ts), id };
  } catch {
    return null;
  }
}

// GET /api/v1/invocations — caller's owned-tool invocations, newest first
app.get("/", async (c) => {
  const caller = c.get("caller");
  requireDeveloper(caller);
  const q = querySchema.parse(c.req.query());

  const where = [eq(invocations.toolOwnerId, caller.developer.id)];
  if (q.slug) where.push(eq(invocations.toolSlug, q.slug));
  if (q.cursor) {
    const decoded = decodeCursor(q.cursor);
    if (decoded) where.push(lt(invocations.calledAt, new Date(decoded.ts)));
  }

  const rows = await db
    .select()
    .from(invocations)
    .where(and(...where))
    .orderBy(desc(invocations.calledAt))
    .limit(q.limit + 1);

  const hasMore = rows.length > q.limit;
  const page = hasMore ? rows.slice(0, q.limit) : rows;

  const items = page.map((r) => ({
    id: r.id,
    toolSlug: r.toolSlug,
    callerKind: r.callerKind,
    callerId: r.callerId,
    status: r.status,
    durationMs: r.durationMs,
    errorMessage: r.errorMessage,
    calledAt: r.calledAt.toISOString(),
  }));

  const nextCursor =
    hasMore && page.length > 0
      ? encodeCursor(page[page.length - 1].calledAt, page[page.length - 1].id)
      : null;

  return c.json({ items, count: items.length, nextCursor });
});

export default app;

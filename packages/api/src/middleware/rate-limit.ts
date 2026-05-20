import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

interface Bucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000;
const buckets = new Map<string, Bucket>();

function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "anonymous";
}

export function rateLimit(maxPerMinute: number) {
  return createMiddleware(async (c, next) => {
    if (maxPerMinute <= 0) return next();
    const key = `${clientKey(c.req.raw)}:${c.req.method}:${new URL(c.req.url).pathname}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + WINDOW_MS };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    c.header("X-RateLimit-Limit", String(maxPerMinute));
    c.header("X-RateLimit-Remaining", String(Math.max(0, maxPerMinute - bucket.count)));
    c.header("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > maxPerMinute) {
      c.header("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      throw new HTTPException(429, { message: "Rate limit exceeded" });
    }
    await next();
  });
}

// Background cleanup so the Map doesn't grow forever
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}, WINDOW_MS).unref();

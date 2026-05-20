import { HTTPException } from "hono/http-exception";
import { getEnv } from "../env.js";

function matches(hostname: string, pattern: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  const p = pattern.toLowerCase().replace(/\.$/, "");
  if (p.startsWith("*.")) {
    const suffix = p.slice(1); // ".example.com"
    return h.endsWith(suffix) || h === suffix.slice(1);
  }
  return h === p;
}

/**
 * Cross-checks an upstream hostname against env block/allow lists. SSRF is
 * already handled by safe-fetch; this is an operator-level policy layer for
 * abuse (e.g. blocking known scraper targets, or restricting to a partner set).
 */
export function assertUpstreamHostAllowed(hostname: string) {
  const env = getEnv();
  for (const pattern of env.UPSTREAM_HOST_DENYLIST) {
    if (matches(hostname, pattern)) {
      throw new HTTPException(400, {
        message: `Upstream host ${hostname} is blocked by operator policy`,
      });
    }
  }
  if (env.UPSTREAM_HOST_ALLOWLIST.length > 0) {
    const ok = env.UPSTREAM_HOST_ALLOWLIST.some((p) => matches(hostname, p));
    if (!ok) {
      throw new HTTPException(400, {
        message: `Upstream host ${hostname} is not in the operator allowlist`,
      });
    }
  }
}

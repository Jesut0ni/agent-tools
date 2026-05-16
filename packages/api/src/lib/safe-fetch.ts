import { HTTPException } from "hono/http-exception";

const PRIVATE_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "::",
]);

const PRIVATE_V4_PREFIXES = [
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^127\./,
  /^0\./,
];

function isPrivateV4(host: string): boolean {
  if (PRIVATE_V4_PREFIXES.some((re) => re.test(host))) return true;
  const m = host.match(/^172\.(\d{1,3})\./);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

/**
 * Reject URLs whose hostname looks internal. This is a string-level check —
 * DNS-rebinding-resistant resolution (lookup + verify against the resolved IP
 * before connecting) is a v0.1 follow-up.
 */
export function assertSafeUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new HTTPException(400, { message: "Invalid endpoint URL" });
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new HTTPException(400, { message: "Endpoint must be http or https" });
  }

  const host = url.hostname.toLowerCase();
  if (PRIVATE_HOSTS.has(host) || isPrivateV4(host)) {
    throw new HTTPException(400, { message: "Endpoint resolves to a private address" });
  }

  return url;
}

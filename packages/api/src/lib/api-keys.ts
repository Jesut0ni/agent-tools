import { createHash, randomBytes } from "node:crypto";

const PREFIX = "at_";

export function generateApiKey(): { full: string; hash: string; preview: string } {
  const raw = randomBytes(32).toString("hex");
  const full = `${PREFIX}${raw}`;
  return {
    full,
    hash: hashApiKey(full),
    preview: previewApiKey(full),
  };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** First 4 + last 4 of the raw portion (after the prefix), for safe UI display. */
export function previewApiKey(key: string): string {
  const raw = key.startsWith(PREFIX) ? key.slice(PREFIX.length) : key;
  const head = raw.slice(0, 4);
  const tail = raw.slice(-4);
  return `${PREFIX}${head}…${tail}`;
}

export function isLikelyApiKey(key: string): boolean {
  return key.startsWith(PREFIX) && key.length === PREFIX.length + 64;
}

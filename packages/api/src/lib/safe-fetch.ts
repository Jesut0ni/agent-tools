import { HTTPException } from "hono/http-exception";
import { promises as dns } from "node:dns";
import net from "node:net";

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return -1;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

const IPV4_BLOCKED: Array<[number, number]> = [
  [ipv4ToInt("0.0.0.0"), 8],
  [ipv4ToInt("10.0.0.0"), 8],
  [ipv4ToInt("100.64.0.0"), 10],
  [ipv4ToInt("127.0.0.0"), 8],
  [ipv4ToInt("169.254.0.0"), 16],
  [ipv4ToInt("172.16.0.0"), 12],
  [ipv4ToInt("192.0.0.0"), 24],
  [ipv4ToInt("192.168.0.0"), 16],
  [ipv4ToInt("198.18.0.0"), 15],
  [ipv4ToInt("224.0.0.0"), 4],
  [ipv4ToInt("240.0.0.0"), 4],
];

function isPrivateIPv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value < 0) return false;
  return IPV4_BLOCKED.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (value & mask) === (base & mask);
  });
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fe80:") || normalized.startsWith("fe80::")) return true;
  if (/^f[cd][0-9a-f]{2}:/.test(normalized)) return true; // fc00::/7 ULA
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — extract and check as IPv4
  const mapped = normalized.match(/^::ffff:([0-9.]+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

function isPrivateIP(addr: string, family: 4 | 6): boolean {
  return family === 4 ? isPrivateIPv4(addr) : isPrivateIPv6(addr);
}

/**
 * Reject URLs whose hostname resolves to any internal/private address.
 * Resolves all A and AAAA records so we don't rely on a single lookup that
 * could be tricked by round-robin DNS.
 */
export async function assertSafeUrl(rawUrl: string): Promise<URL> {
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

  // Direct literals (no DNS lookup needed)
  if (net.isIPv4(host)) {
    if (isPrivateIPv4(host)) {
      throw new HTTPException(400, {
        message: `Endpoint resolves to a private address (${host})`,
      });
    }
    return url;
  }
  if (net.isIPv6(host.replace(/^\[|\]$/g, ""))) {
    const ip = host.replace(/^\[|\]$/g, "");
    if (isPrivateIPv6(ip)) {
      throw new HTTPException(400, {
        message: `Endpoint resolves to a private address (${ip})`,
      });
    }
    return url;
  }

  // Hostname → resolve all
  let resolved: Array<{ address: string; family: number }>;
  try {
    resolved = await dns.lookup(host, { all: true });
  } catch (err) {
    throw new HTTPException(400, {
      message: `Could not resolve endpoint host: ${(err as Error).message}`,
    });
  }

  for (const r of resolved) {
    if (isPrivateIP(r.address, r.family as 4 | 6)) {
      throw new HTTPException(400, {
        message: `Endpoint resolves to a private address (${r.address})`,
      });
    }
  }

  return url;
}

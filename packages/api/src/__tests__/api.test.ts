import { describe, it, expect, beforeAll } from "vitest";
import { SignJWT } from "jose";
import type { Hono } from "hono";
import { eq } from "drizzle-orm";

let app: Hono;

beforeAll(async () => {
  const { createApp } = await import("../app.js");
  app = createApp();
});

async function jsonRequest(
  url: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<{ status: number; body: any }> {
  const { json, headers, ...rest } = init;
  const res = await app.request(url, {
    ...rest,
    headers: {
      "content-type": "application/json",
      ...(headers as Record<string, string>),
    },
    body: json !== undefined ? JSON.stringify(json) : (init.body as BodyInit | undefined),
  });
  const text = await res.text();
  let body: any = text;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      /* keep text */
    }
  }
  return { status: res.status, body };
}

/** Sign up + verify in one helper, returning the minted API key. */
async function signup(email: string): Promise<{ apiKey: string; id: string }> {
  const start = await jsonRequest("/api/v1/developers", { method: "POST", json: { email } });
  expect(start.status).toBe(202);
  expect(start.body.token).toBeDefined();
  const done = await jsonRequest("/api/v1/developers/verify", {
    method: "POST",
    json: { token: start.body.token },
  });
  expect(done.status).toBe(201);
  return { apiKey: done.body.apiKey, id: done.body.id };
}

function publishBody(overrides: Partial<{ slug: string; spec: any }> = {}) {
  return {
    slug: overrides.slug ?? "test-tool",
    name: "Test tool",
    description: "",
    version: "0.1.0",
    spec: overrides.spec ?? {
      endpoint: { method: "POST", url: "https://example.com/" },
      input: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
      output: { type: "object" },
      auth: { type: "none" },
    },
  };
}

describe("developers / email verification", () => {
  it("signup returns a token (NOT an api key) in dev/test mode", async () => {
    const res = await jsonRequest("/api/v1/developers", {
      method: "POST",
      json: { email: "a@example.com" },
    });
    expect(res.status).toBe(202);
    expect(res.body.verificationRequired).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.apiKey).toBeUndefined();
  });

  it("verify mints an api key once", async () => {
    const start = await jsonRequest("/api/v1/developers", {
      method: "POST",
      json: { email: "b@example.com" },
    });
    const done = await jsonRequest("/api/v1/developers/verify", {
      method: "POST",
      json: { token: start.body.token },
    });
    expect(done.status).toBe(201);
    expect(done.body.apiKey).toMatch(/^at_[a-f0-9]{64}$/);
  });

  it("verify with bogus token → 404", async () => {
    const res = await jsonRequest("/api/v1/developers/verify", {
      method: "POST",
      json: { token: "this-token-does-not-exist-anywhere-123" },
    });
    expect(res.status).toBe(404);
  });

  it("verify a token a second time → 409", async () => {
    const start = await jsonRequest("/api/v1/developers", {
      method: "POST",
      json: { email: "c@example.com" },
    });
    await jsonRequest("/api/v1/developers/verify", {
      method: "POST",
      json: { token: start.body.token },
    });
    const second = await jsonRequest("/api/v1/developers/verify", {
      method: "POST",
      json: { token: start.body.token },
    });
    expect(second.status).toBe(404); // token cleared after consumption
  });

  it("duplicate signup for unverified email re-issues token; for verified returns 409", async () => {
    const first = await jsonRequest("/api/v1/developers", {
      method: "POST",
      json: { email: "d@example.com" },
    });
    const reissue = await jsonRequest("/api/v1/developers", {
      method: "POST",
      json: { email: "d@example.com" },
    });
    expect(reissue.status).toBe(202);
    expect(reissue.body.token).not.toBe(first.body.token);

    await jsonRequest("/api/v1/developers/verify", {
      method: "POST",
      json: { token: reissue.body.token },
    });
    const afterVerify = await jsonRequest("/api/v1/developers", {
      method: "POST",
      json: { email: "d@example.com" },
    });
    expect(afterVerify.status).toBe(409);
  });

  it("/me requires an api key", async () => {
    const { apiKey, id } = await signup("e@example.com");
    const anon = await jsonRequest("/api/v1/developers/me");
    expect(anon.status).toBe(401);
    const me = await jsonRequest("/api/v1/developers/me", {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    expect(me.status).toBe(200);
    expect(me.body.id).toBe(id);
  });
});

describe("tools — publish & ownership", () => {
  it("anon publish is 401", async () => {
    const res = await jsonRequest("/api/v1/tools", { method: "POST", json: publishBody() });
    expect(res.status).toBe(401);
  });

  it("authed publish creates the tool with ownerId", async () => {
    const { apiKey, id } = await signup("p1@example.com");
    const res = await jsonRequest("/api/v1/tools", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      json: publishBody({ slug: "auth-publish" }),
    });
    expect(res.status).toBe(201);
    expect(res.body.ownerId).toBe(id);
  });

  it("delete by non-owner is 403, by owner is 204", async () => {
    const owner = await signup("p2@example.com");
    const other = await signup("p3@example.com");
    await jsonRequest("/api/v1/tools", {
      method: "POST",
      headers: { authorization: `Bearer ${owner.apiKey}` },
      json: publishBody({ slug: "owned" }),
    });
    const forbidden = await jsonRequest("/api/v1/tools/owned", {
      method: "DELETE",
      headers: { authorization: `Bearer ${other.apiKey}` },
    });
    expect(forbidden.status).toBe(403);
    const ok = await jsonRequest("/api/v1/tools/owned", {
      method: "DELETE",
      headers: { authorization: `Bearer ${owner.apiKey}` },
    });
    expect(ok.status).toBe(204);
  });
});

describe("tools — validation", () => {
  it("invalid JSON Schema → 400", async () => {
    const { apiKey } = await signup("v1@example.com");
    const res = await jsonRequest("/api/v1/tools", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      json: publishBody({
        slug: "bad-schema",
        spec: {
          endpoint: { method: "POST", url: "https://example.com/" },
          input: { type: "nonsense-type" },
          output: { type: "object" },
          auth: { type: "none" },
        },
      }),
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/not a valid JSON Schema/);
  });

  it("invoke input that violates schema → 400", async () => {
    const { apiKey } = await signup("v2@example.com");
    await jsonRequest("/api/v1/tools", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      json: publishBody({ slug: "needs-message" }),
    });
    const res = await jsonRequest("/api/v1/tools/needs-message/call", {
      method: "POST",
      json: { wrong: "field" },
    });
    expect(res.status).toBe(400);
  });
});

describe("tools — SSRF & host policy", () => {
  it("rejects literal private IPv4", async () => {
    const { apiKey } = await signup("s1@example.com");
    await jsonRequest("/api/v1/tools", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      json: publishBody({
        slug: "ssrf-v4",
        spec: {
          endpoint: { method: "GET", url: "http://127.0.0.1/" },
          input: { type: "object" },
          output: { type: "object" },
          auth: { type: "none" },
        },
      }),
    });
    const res = await jsonRequest("/api/v1/tools/ssrf-v4/call", { method: "POST", json: {} });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/private address/);
  });

  it("rejects literal IPv6 loopback", async () => {
    const { apiKey } = await signup("s2@example.com");
    await jsonRequest("/api/v1/tools", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      json: publishBody({
        slug: "ssrf-v6",
        spec: {
          endpoint: { method: "GET", url: "http://[::1]/" },
          input: { type: "object" },
          output: { type: "object" },
          auth: { type: "none" },
        },
      }),
    });
    const res = await jsonRequest("/api/v1/tools/ssrf-v6/call", { method: "POST", json: {} });
    expect(res.status).toBe(400);
  });

  it("upstream host on denylist is rejected at publish time", async () => {
    const { apiKey } = await signup("s3@example.com");
    const res = await jsonRequest("/api/v1/tools", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      json: publishBody({
        slug: "denylisted",
        spec: {
          endpoint: { method: "GET", url: "https://blocked.example.com/" },
          input: { type: "object" },
          output: { type: "object" },
          auth: { type: "none" },
        },
      }),
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/blocked by operator policy/);
  });
});

describe("tools — AgentGate JWT", () => {
  async function makeJwt(opts: { scopes?: string[]; expired?: boolean } = {}) {
    const { getEnv } = await import("../env.js");
    const env = getEnv();
    const secret = new TextEncoder().encode(env.AGENTGATE_JWT_SECRET);
    const ISSUER = env.AGENTGATE_JWT_ISSUER;
    const jwt = new SignJWT({
      sub: "agent-test",
      scope: (opts.scopes ?? ["tools:call"]).join(" "),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(ISSUER)
      .setIssuedAt();
    if (opts.expired) jwt.setExpirationTime("-1m");
    else jwt.setExpirationTime("5m");
    return jwt.sign(secret);
  }

  it("missing/bogus/expired/wrong-scope all rejected", async () => {
    const { apiKey } = await signup("jwt@example.com");
    await jsonRequest("/api/v1/tools", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      json: publishBody({
        slug: "gated",
        spec: {
          endpoint: { method: "POST", url: "https://example.com/" },
          input: { type: "object" },
          output: { type: "object" },
          auth: { type: "agentgate", scopes: ["tools:call"] },
        },
      }),
    });
    const noToken = await jsonRequest("/api/v1/tools/gated/call", { method: "POST", json: {} });
    expect(noToken.status).toBe(401);
    const bogus = await jsonRequest("/api/v1/tools/gated/call", {
      method: "POST",
      headers: { authorization: "Bearer nope" },
      json: {},
    });
    expect(bogus.status).toBe(401);
    const wrong = await jsonRequest("/api/v1/tools/gated/call", {
      method: "POST",
      headers: { authorization: `Bearer ${await makeJwt({ scopes: ["other"] })}` },
      json: {},
    });
    expect(wrong.status).toBe(403);
  });
});

describe("abuse controls", () => {
  it("MAX_TOOLS_PER_DEVELOPER caps publish", async () => {
    const { apiKey } = await signup("cap@example.com");
    const headers = { authorization: `Bearer ${apiKey}` };
    for (let i = 0; i < 5; i++) {
      const r = await jsonRequest("/api/v1/tools", {
        method: "POST",
        headers,
        json: publishBody({ slug: `cap-${i}` }),
      });
      expect(r.status).toBe(201);
    }
    const sixth = await jsonRequest("/api/v1/tools", {
      method: "POST",
      headers,
      json: publishBody({ slug: "cap-6" }),
    });
    expect(sixth.status).toBe(403);
    expect(sixth.body.error.message).toMatch(/Tool cap/);
  });

  it("suspended developer cannot publish", async () => {
    const { apiKey, id } = await signup("susp@example.com");
    const { db } = await import("../db/client.js");
    const { developers } = await import("../db/schema/developers.js");
    await db.update(developers).set({ suspended: true }).where(eq(developers.id, id));
    const res = await jsonRequest("/api/v1/tools", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      json: publishBody({ slug: "susp-tool" }),
    });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/suspended/);
  });

  it("daily call cap kicks in for developer caller", async () => {
    const { apiKey, id } = await signup("daily@example.com");
    const headers = { authorization: `Bearer ${apiKey}` };
    const pub = await jsonRequest("/api/v1/tools", {
      method: "POST",
      headers,
      json: publishBody({
        slug: "daily-tool",
        spec: {
          endpoint: { method: "GET", url: "http://127.0.0.1/" }, // SSRF guard will mark errors, but the row is still written
          input: { type: "object" },
          output: { type: "object" },
          auth: { type: "none" },
        },
      }),
    });
    expect(pub.status).toBe(201);

    // Pre-populate 3 prior invocations to hit MAX=3
    const { db } = await import("../db/client.js");
    const { invocations } = await import("../db/schema/invocations.js");
    for (let i = 0; i < 3; i++) {
      await db.insert(invocations).values({
        toolId: pub.body.id,
        toolSlug: "daily-tool",
        toolOwnerId: id,
        callerKind: "developer",
        callerId: id,
        status: 200,
        durationMs: 5,
      });
    }
    const capped = await jsonRequest("/api/v1/tools/daily-tool/call", {
      method: "POST",
      headers,
      json: {},
    });
    expect(capped.status).toBe(429);
    expect(capped.body.error.message).toMatch(/Daily call cap/);
  });
});

describe("audit log", () => {
  it("invocation produces a row visible to the owner", async () => {
    const { apiKey } = await signup("audit@example.com");
    const headers = { authorization: `Bearer ${apiKey}` };
    await jsonRequest("/api/v1/tools", {
      method: "POST",
      headers,
      json: publishBody({
        slug: "audit-tool",
        spec: {
          endpoint: { method: "GET", url: "http://127.0.0.1/" },
          input: { type: "object" },
          output: { type: "object" },
          auth: { type: "none" },
        },
      }),
    });
    // SSRF will reject, but the row is still written
    await jsonRequest("/api/v1/tools/audit-tool/call", { method: "POST", json: {} });
    const log = await jsonRequest("/api/v1/invocations?slug=audit-tool", { headers });
    expect(log.status).toBe(200);
    expect(log.body.count).toBe(1);
    expect(log.body.items[0].status).toBe(400);
    expect(log.body.items[0].errorMessage).toMatch(/private address/);
  });

  it("only the tool owner sees invocations", async () => {
    const owner = await signup("aud-owner@example.com");
    const other = await signup("aud-other@example.com");
    await jsonRequest("/api/v1/tools", {
      method: "POST",
      headers: { authorization: `Bearer ${owner.apiKey}` },
      json: publishBody({
        slug: "audit-private",
        spec: {
          endpoint: { method: "GET", url: "http://127.0.0.1/" },
          input: { type: "object" },
          output: { type: "object" },
          auth: { type: "none" },
        },
      }),
    });
    await jsonRequest("/api/v1/tools/audit-private/call", { method: "POST", json: {} });
    const otherView = await jsonRequest("/api/v1/invocations?slug=audit-private", {
      headers: { authorization: `Bearer ${other.apiKey}` },
    });
    expect(otherView.status).toBe(200);
    expect(otherView.body.count).toBe(0);
  });
});

describe("mcp", () => {
  it("initialize works", async () => {
    const res = await jsonRequest("/api/v1/mcp", {
      method: "POST",
      json: { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "1" } } },
    });
    expect(res.status).toBe(200);
    expect(res.body.result.serverInfo.name).toBe("agent-tools");
  });

  it("tools/list exposes published tools", async () => {
    const { apiKey } = await signup("mcp@example.com");
    await jsonRequest("/api/v1/tools", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      json: publishBody({ slug: "mcp-tool" }),
    });
    const res = await jsonRequest("/api/v1/mcp", {
      method: "POST",
      json: { jsonrpc: "2.0", id: 2, method: "tools/list" },
    });
    expect(res.body.result.tools.some((t: any) => t.name === "mcp-tool")).toBe(true);
  });

  it("unknown method returns -32601", async () => {
    const res = await jsonRequest("/api/v1/mcp", {
      method: "POST",
      json: { jsonrpc: "2.0", id: 99, method: "no/such/method" },
    });
    expect(res.body.error.code).toBe(-32601);
  });
});

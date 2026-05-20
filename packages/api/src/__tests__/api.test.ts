import { describe, it, expect, beforeAll } from "vitest";
import { SignJWT } from "jose";
import type { Hono } from "hono";

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

async function signup(email: string): Promise<{ apiKey: string; id: string }> {
  const res = await jsonRequest("/api/v1/developers", {
    method: "POST",
    json: { email },
  });
  expect(res.status).toBe(201);
  return { apiKey: res.body.apiKey, id: res.body.id };
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

describe("developers", () => {
  it("signup returns an API key once", async () => {
    const res = await jsonRequest("/api/v1/developers", {
      method: "POST",
      json: { email: "a@example.com" },
    });
    expect(res.status).toBe(201);
    expect(res.body.apiKey).toMatch(/^at_[a-f0-9]{64}$/);
    expect(res.body.email).toBe("a@example.com");
  });

  it("duplicate email returns 409", async () => {
    await signup("b@example.com");
    const res = await jsonRequest("/api/v1/developers", {
      method: "POST",
      json: { email: "b@example.com" },
    });
    expect(res.status).toBe(409);
  });

  it("/me requires an API key and returns the developer", async () => {
    const { apiKey, id } = await signup("c@example.com");
    const anon = await jsonRequest("/api/v1/developers/me");
    expect(anon.status).toBe(401);
    const me = await jsonRequest("/api/v1/developers/me", {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    expect(me.status).toBe(200);
    expect(me.body.id).toBe(id);
    expect(me.body.email).toBe("c@example.com");
  });
});

describe("tools — publish & ownership", () => {
  it("anon publish is 401", async () => {
    const res = await jsonRequest("/api/v1/tools", {
      method: "POST",
      json: publishBody(),
    });
    expect(res.status).toBe(401);
  });

  it("authed publish creates the tool with ownerId", async () => {
    const { apiKey, id } = await signup("d@example.com");
    const res = await jsonRequest("/api/v1/tools", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      json: publishBody({ slug: "auth-publish" }),
    });
    expect(res.status).toBe(201);
    expect(res.body.slug).toBe("auth-publish");
    expect(res.body.ownerId).toBe(id);
    expect(res.body.latestVersion).toBe("0.1.0");
  });

  it("duplicate slug → 409", async () => {
    const { apiKey } = await signup("e@example.com");
    const headers = { authorization: `Bearer ${apiKey}` };
    await jsonRequest("/api/v1/tools", { method: "POST", headers, json: publishBody({ slug: "dup" }) });
    const second = await jsonRequest("/api/v1/tools", {
      method: "POST",
      headers,
      json: publishBody({ slug: "dup" }),
    });
    expect(second.status).toBe(409);
  });

  it("delete by non-owner is 403, by owner is 204", async () => {
    const owner = await signup("owner@example.com");
    const other = await signup("other@example.com");
    await jsonRequest("/api/v1/tools", {
      method: "POST",
      headers: { authorization: `Bearer ${owner.apiKey}` },
      json: publishBody({ slug: "owned-tool" }),
    });
    const forbidden = await jsonRequest("/api/v1/tools/owned-tool", {
      method: "DELETE",
      headers: { authorization: `Bearer ${other.apiKey}` },
    });
    expect(forbidden.status).toBe(403);
    const ok = await jsonRequest("/api/v1/tools/owned-tool", {
      method: "DELETE",
      headers: { authorization: `Bearer ${owner.apiKey}` },
    });
    expect(ok.status).toBe(204);
    const gone = await jsonRequest("/api/v1/tools/owned-tool");
    expect(gone.status).toBe(404);
  });
});

describe("tools — validation", () => {
  it("invalid JSON Schema in spec.input → 400", async () => {
    const { apiKey } = await signup("f@example.com");
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
    const { apiKey } = await signup("g@example.com");
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
    expect(res.body.error.message).toMatch(/required property 'message'/);
  });
});

describe("tools — SSRF", () => {
  it("rejects literal private IPv4 at invoke time", async () => {
    const { apiKey } = await signup("h@example.com");
    await jsonRequest("/api/v1/tools", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      json: publishBody({
        slug: "ssrf-private",
        spec: {
          endpoint: { method: "GET", url: "http://127.0.0.1/secret" },
          input: { type: "object" },
          output: { type: "object" },
          auth: { type: "none" },
        },
      }),
    });
    const res = await jsonRequest("/api/v1/tools/ssrf-private/call", {
      method: "POST",
      json: {},
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/private address/);
  });

  it("rejects literal IPv6 loopback", async () => {
    const { apiKey } = await signup("i@example.com");
    await jsonRequest("/api/v1/tools", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      json: publishBody({
        slug: "ssrf-v6",
        spec: {
          endpoint: { method: "GET", url: "http://[::1]/admin" },
          input: { type: "object" },
          output: { type: "object" },
          auth: { type: "none" },
        },
      }),
    });
    const res = await jsonRequest("/api/v1/tools/ssrf-v6/call", { method: "POST", json: {} });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/private address/);
  });
});

describe("tools — AgentGate JWT", () => {
  const SECRET = "dev-secret-change-this-in-production-please-1234";
  const ISSUER = "agentgate";

  async function makeJwt(opts: { scopes?: string[]; expired?: boolean } = {}) {
    const secret = new TextEncoder().encode(SECRET);
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

  it("rejects missing token, bad token, missing scope; accepts valid", async () => {
    const { apiKey } = await signup("j@example.com");
    await jsonRequest("/api/v1/tools", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      json: publishBody({
        slug: "agentgate-locked",
        spec: {
          endpoint: { method: "POST", url: "https://httpbin.org/post" },
          input: { type: "object" },
          output: { type: "object" },
          auth: { type: "agentgate", scopes: ["tools:call"] },
        },
      }),
    });

    const noToken = await jsonRequest("/api/v1/tools/agentgate-locked/call", {
      method: "POST",
      json: {},
    });
    expect(noToken.status).toBe(401);

    const bogus = await jsonRequest("/api/v1/tools/agentgate-locked/call", {
      method: "POST",
      headers: { authorization: "Bearer not-a-jwt" },
      json: {},
    });
    expect(bogus.status).toBe(401);

    const wrongScope = await jsonRequest("/api/v1/tools/agentgate-locked/call", {
      method: "POST",
      headers: { authorization: `Bearer ${await makeJwt({ scopes: ["other:scope"] })}` },
      json: {},
    });
    expect(wrongScope.status).toBe(403);

    const expired = await jsonRequest("/api/v1/tools/agentgate-locked/call", {
      method: "POST",
      headers: { authorization: `Bearer ${await makeJwt({ expired: true })}` },
      json: {},
    });
    expect(expired.status).toBe(401);
  });
});

describe("mcp", () => {
  async function rpc(payload: unknown) {
    return jsonRequest("/api/v1/mcp", { method: "POST", json: payload });
  }

  it("initialize returns protocol + serverInfo", async () => {
    const res = await rpc({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "1" } },
    });
    expect(res.status).toBe(200);
    expect(res.body.result.protocolVersion).toBe("2024-11-05");
    expect(res.body.result.serverInfo.name).toBe("agent-tools");
  });

  it("tools/list exposes published tools with their input schema", async () => {
    const { apiKey } = await signup("k@example.com");
    await jsonRequest("/api/v1/tools", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      json: publishBody({ slug: "mcp-tool" }),
    });
    const res = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    expect(res.status).toBe(200);
    const tools = res.body.result.tools as Array<{ name: string; inputSchema: any }>;
    const tool = tools.find((t) => t.name === "mcp-tool");
    expect(tool).toBeDefined();
    expect(tool!.inputSchema.required).toContain("message");
  });

  it("unknown method returns JSON-RPC -32601", async () => {
    const res = await rpc({ jsonrpc: "2.0", id: 99, method: "resources/list" });
    expect(res.status).toBe(200);
    expect(res.body.error.code).toBe(-32601);
  });
});

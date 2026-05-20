import { HTTPException } from "hono/http-exception";
import { and, eq } from "drizzle-orm";
import { toolSpecSchema, type ToolSpec } from "@agent-tools/shared";
import { db } from "../db/client.js";
import { tools, toolVersions, type ToolRow } from "../db/schema/tools.js";
import { assertSafeUrl } from "../lib/safe-fetch.js";
import { validateAgainstSchema } from "../lib/json-schema.js";
import { verifyAgentGateToken } from "../lib/agentgate-jwt.js";
import { getEnv } from "../env.js";
import { logger } from "../lib/logger.js";
import type { Caller } from "../middleware/auth.js";

export interface InvokeResult {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  durationMs: number;
}

export async function loadLatestSpec(toolId: string, version: string | null): Promise<ToolSpec | null> {
  if (!version) return null;
  const row = await db.query.toolVersions.findFirst({
    where: and(eq(toolVersions.toolId, toolId), eq(toolVersions.version, version)),
  });
  return row ? (row.spec as ToolSpec) : null;
}

export async function loadToolBySlug(slug: string): Promise<ToolRow> {
  const row = await db.query.tools.findFirst({ where: eq(tools.slug, slug) });
  if (!row) throw new HTTPException(404, { message: `Tool ${slug} not found` });
  return row;
}

export async function invokeRegisteredTool(
  slug: string,
  rawInput: unknown,
  caller: Caller
): Promise<InvokeResult> {
  const tool = await loadToolBySlug(slug);
  const spec = toolSpecSchema.parse(await loadLatestSpec(tool.id, tool.latestVersion));

  const url = await assertSafeUrl(spec.endpoint.url);

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": "agent-tools/0.1",
  };

  if (spec.auth.type === "bearer") {
    if (!caller) {
      throw new HTTPException(401, { message: "Tool requires a bearer token" });
    }
    headers[spec.auth.headerName.toLowerCase()] = `Bearer ${caller.raw}`;
  }

  if (spec.auth.type === "agentgate") {
    if (!caller) {
      throw new HTTPException(401, { message: "Tool requires AgentGate auth" });
    }
    const claims = await verifyAgentGateToken(caller.raw, spec.auth.scopes);
    headers["authorization"] = `Bearer ${caller.raw}`;
    headers["x-agentgate-subject"] = String(claims.sub ?? "");
  }

  const inputIssues = validateAgainstSchema(spec.input, rawInput);
  if (inputIssues) {
    throw new HTTPException(400, { message: `input does not match schema: ${inputIssues}` });
  }

  const method = spec.endpoint.method;
  const usesQueryParams = method === "GET" || method === "DELETE";

  if (usesQueryParams && rawInput && typeof rawInput === "object") {
    for (const [key, value] of Object.entries(rawInput as Record<string, unknown>)) {
      if (value === undefined || value === null) continue;
      const encoded =
        typeof value === "string" || typeof value === "number" || typeof value === "boolean"
          ? String(value)
          : JSON.stringify(value);
      url.searchParams.set(key, encoded);
    }
  }

  const body = usesQueryParams ? undefined : JSON.stringify(rawInput ?? {});

  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getEnv().CALL_TIMEOUT_MS);

  let upstream: Response;
  try {
    upstream = await fetch(url, { method, headers, body, signal: controller.signal });
  } catch (err) {
    clearTimeout(timeout);
    logger.warn({ err, slug }, "Upstream call failed");
    throw new HTTPException(502, { message: "Upstream call failed" });
  }
  clearTimeout(timeout);

  const text = await upstream.text();
  let parsed: unknown = text;
  const contentType = upstream.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  return {
    status: upstream.status,
    headers: Object.fromEntries(upstream.headers.entries()),
    body: parsed,
    durationMs: Date.now() - started,
  };
}

import { HTTPException } from "hono/http-exception";
import { and, eq, gte, sql } from "drizzle-orm";
import { toolSpecSchema, type ToolSpec } from "@agent-tools/shared";
import { db } from "../db/client.js";
import { tools, toolVersions, type ToolRow } from "../db/schema/tools.js";
import { developers } from "../db/schema/developers.js";
import { invocations } from "../db/schema/invocations.js";
import { assertSafeUrl } from "../lib/safe-fetch.js";
import { validateAgainstSchema } from "../lib/json-schema.js";
import { verifyAgentGateToken } from "../lib/agentgate-jwt.js";
import { assertUpstreamHostAllowed } from "../lib/host-allow.js";
import { getEnv } from "../env.js";
import { logger } from "../lib/logger.js";
import type { Caller } from "../middleware/auth.js";

export interface InvokeResult {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  durationMs: number;
}

async function loadLatestSpec(toolId: string, version: string | null): Promise<ToolSpec | null> {
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

export { loadLatestSpec };

interface InvocationWriteInput {
  tool: ToolRow;
  caller: Caller;
  status: number;
  durationMs: number;
  errorMessage: string | null;
}

async function writeInvocation(input: InvocationWriteInput) {
  try {
    const callerKind: "developer" | "agent" | "anonymous" = !input.caller
      ? "anonymous"
      : input.caller.kind === "developer"
        ? "developer"
        : "agent";
    const callerId =
      input.caller?.kind === "developer" ? input.caller.developer.id : null;
    await db.insert(invocations).values({
      toolId: input.tool.id,
      toolSlug: input.tool.slug,
      toolOwnerId: input.tool.ownerId,
      callerKind,
      callerId,
      status: input.status,
      durationMs: input.durationMs,
      errorMessage: input.errorMessage,
    });
  } catch (err) {
    logger.warn({ err, slug: input.tool.slug }, "Failed to write invocation row");
  }
}

async function enforceDailyCap(caller: Caller, max: number) {
  if (max <= 0) return;
  if (!caller || caller.kind !== "developer") return;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(invocations)
    .where(and(eq(invocations.callerId, caller.developer.id), gte(invocations.calledAt, since)));
  const count = Number(rows[0]?.count ?? 0);
  if (count >= max) {
    throw new HTTPException(429, {
      message: `Daily call cap of ${max} reached. Try again later.`,
    });
  }
}

export async function invokeRegisteredTool(
  slug: string,
  rawInput: unknown,
  caller: Caller
): Promise<InvokeResult> {
  const env = getEnv();
  const tool = await loadToolBySlug(slug);

  // Enforce caller-side daily cap before doing any work
  await enforceDailyCap(caller, env.MAX_CALLS_PER_DEVELOPER_PER_DAY);

  // Refuse to proxy calls for a suspended owner — protects abuse via legitimate keys
  if (tool.ownerId) {
    const owner = await db.query.developers.findFirst({
      where: eq(developers.id, tool.ownerId),
    });
    if (owner?.suspended) {
      const status = 451;
      const message = `Tool ${slug} is currently disabled`;
      await writeInvocation({ tool, caller, status, durationMs: 0, errorMessage: message });
      throw new HTTPException(status, { message });
    }
  }

  let status = 0;
  let durationMs = 0;
  let errorMessage: string | null = null;

  try {
    const spec = toolSpecSchema.parse(await loadLatestSpec(tool.id, tool.latestVersion));
    const url = await assertSafeUrl(spec.endpoint.url);
    assertUpstreamHostAllowed(url.hostname);

    const headers: Record<string, string> = {
      "content-type": "application/json",
      "user-agent": "agent-tools/0.6",
    };

    if (spec.auth.type === "bearer") {
      if (!caller) throw new HTTPException(401, { message: "Tool requires a bearer token" });
      headers[spec.auth.headerName.toLowerCase()] = `Bearer ${caller.raw}`;
    }

    if (spec.auth.type === "agentgate") {
      if (!caller) throw new HTTPException(401, { message: "Tool requires AgentGate auth" });
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
    const timeout = setTimeout(() => controller.abort(), env.CALL_TIMEOUT_MS);

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

    status = upstream.status;
    durationMs = Date.now() - started;

    return {
      status,
      headers: Object.fromEntries(upstream.headers.entries()),
      body: parsed,
      durationMs,
    };
  } catch (err) {
    if (err instanceof HTTPException) {
      status = err.status;
      errorMessage = err.message;
    } else {
      status = 500;
      errorMessage = (err as Error).message;
    }
    throw err;
  } finally {
    await writeInvocation({ tool, caller, status, durationMs, errorMessage });
  }
}

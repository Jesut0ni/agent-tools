import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { and, desc, eq, like, or } from "drizzle-orm";
import {
  publishToolSchema,
  publishVersionSchema,
  listToolsQuerySchema,
  toolSpecSchema,
  type ToolSpec,
} from "@agent-tools/shared";
import { db } from "../db/client.js";
import { tools, toolVersions, type ToolRow } from "../db/schema/tools.js";
import { authMiddleware, type Caller } from "../middleware/auth.js";
import { assertSafeUrl } from "../lib/safe-fetch.js";
import { getEnv } from "../env.js";
import { logger } from "../lib/logger.js";

type Vars = { Variables: { caller: Caller } };

const app = new Hono<Vars>();

app.use("*", authMiddleware);

function serializeTool(row: ToolRow, spec: ToolSpec | null = null) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    ownerId: row.ownerId,
    visibility: row.visibility,
    latestVersion: row.latestVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    spec,
  };
}

async function loadToolBySlug(slug: string): Promise<ToolRow> {
  const row = await db.query.tools.findFirst({ where: eq(tools.slug, slug) });
  if (!row) throw new HTTPException(404, { message: `Tool ${slug} not found` });
  return row;
}

async function loadLatestSpec(toolId: string, version: string | null): Promise<ToolSpec | null> {
  if (!version) return null;
  const row = await db.query.toolVersions.findFirst({
    where: and(eq(toolVersions.toolId, toolId), eq(toolVersions.version, version)),
  });
  return row ? (row.spec as ToolSpec) : null;
}

// POST /tools — publish a new tool with its first version
app.post("/", async (c) => {
  const body = publishToolSchema.parse(await c.req.json());
  const caller = c.get("caller");

  const existing = await db.query.tools.findFirst({ where: eq(tools.slug, body.slug) });
  if (existing) {
    throw new HTTPException(409, { message: `Tool ${body.slug} already exists` });
  }

  const now = new Date();
  const [tool] = await db
    .insert(tools)
    .values({
      slug: body.slug,
      name: body.name,
      description: body.description,
      visibility: body.visibility,
      ownerId: caller?.id ?? null,
      latestVersion: body.version,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await db.insert(toolVersions).values({
    toolId: tool.id,
    version: body.version,
    spec: body.spec,
    createdAt: now,
  });

  return c.json(serializeTool(tool, body.spec), 201);
});

// GET /tools — list public tools with optional search
app.get("/", async (c) => {
  const query = listToolsQuerySchema.parse(c.req.query());

  const whereClauses = [eq(tools.visibility, "public")];
  if (query.q) {
    const term = `%${query.q.toLowerCase()}%`;
    const searchClause = or(like(tools.slug, term), like(tools.name, term), like(tools.description, term));
    if (searchClause) whereClauses.push(searchClause);
  }

  const rows = await db
    .select()
    .from(tools)
    .where(and(...whereClauses))
    .orderBy(desc(tools.updatedAt))
    .limit(query.limit);

  return c.json({
    items: rows.map((r) => serializeTool(r)),
    count: rows.length,
  });
});

// GET /tools/:slug — tool detail with latest spec
app.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const tool = await loadToolBySlug(slug);
  const spec = await loadLatestSpec(tool.id, tool.latestVersion);
  return c.json(serializeTool(tool, spec));
});

// GET /tools/:slug/versions — list versions
app.get("/:slug/versions", async (c) => {
  const slug = c.req.param("slug");
  const tool = await loadToolBySlug(slug);
  const versions = await db
    .select()
    .from(toolVersions)
    .where(eq(toolVersions.toolId, tool.id))
    .orderBy(desc(toolVersions.createdAt));
  return c.json({
    items: versions.map((v) => ({
      id: v.id,
      version: v.version,
      spec: v.spec as ToolSpec,
      createdAt: v.createdAt.toISOString(),
    })),
    count: versions.length,
  });
});

// POST /tools/:slug/versions — publish a new version of an existing tool
app.post("/:slug/versions", async (c) => {
  const slug = c.req.param("slug");
  const body = publishVersionSchema.parse(await c.req.json());
  const tool = await loadToolBySlug(slug);

  const dup = await db.query.toolVersions.findFirst({
    where: and(eq(toolVersions.toolId, tool.id), eq(toolVersions.version, body.version)),
  });
  if (dup) {
    throw new HTTPException(409, { message: `Version ${body.version} already exists for ${slug}` });
  }

  const now = new Date();
  await db.insert(toolVersions).values({
    toolId: tool.id,
    version: body.version,
    spec: body.spec,
    createdAt: now,
  });

  await db
    .update(tools)
    .set({ latestVersion: body.version, updatedAt: now })
    .where(eq(tools.id, tool.id));

  return c.json({ slug, version: body.version, spec: body.spec }, 201);
});

// POST /tools/:slug/call — proxy invoke
app.post("/:slug/call", async (c) => {
  const slug = c.req.param("slug");
  const tool = await loadToolBySlug(slug);
  const spec = toolSpecSchema.parse(await loadLatestSpec(tool.id, tool.latestVersion));

  const url = assertSafeUrl(spec.endpoint.url);
  const caller = c.get("caller");

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": "agent-tools/0.1",
  };

  if (spec.auth.type === "bearer") {
    if (!caller) {
      throw new HTTPException(401, { message: "Tool requires bearer token" });
    }
    headers[spec.auth.headerName.toLowerCase()] = `Bearer ${caller.raw}`;
  }

  if (spec.auth.type === "agentgate") {
    // v0.1: validate AgentGate JWT + check scopes against spec.auth.scopes
    if (!caller) {
      throw new HTTPException(401, { message: "Tool requires AgentGate auth" });
    }
    headers["authorization"] = `Bearer ${caller.raw}`;
  }

  const method = spec.endpoint.method;
  const input = method === "GET" || method === "DELETE" ? undefined : await c.req.json().catch(() => ({}));

  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getEnv().CALL_TIMEOUT_MS);

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method,
      headers,
      body: input === undefined ? undefined : JSON.stringify(input),
      signal: controller.signal,
    });
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

  return c.json({
    status: upstream.status,
    headers: Object.fromEntries(upstream.headers.entries()),
    body: parsed,
    durationMs: Date.now() - started,
  });
});

export default app;

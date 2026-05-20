import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { tools } from "../db/schema/tools.js";
import { authMiddleware, type Caller } from "../middleware/auth.js";
import { invokeRegisteredTool, loadLatestSpec } from "../services/invoke.js";
import { logger } from "../lib/logger.js";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "agent-tools", version: "0.5.0" };

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: unknown;
}

type Vars = { Variables: { caller: Caller } };
const app = new Hono<Vars>();

app.use("*", authMiddleware);

function rpcResult(id: number | string | null | undefined, result: unknown) {
  return { jsonrpc: "2.0" as const, id: id ?? null, result };
}

function rpcError(
  id: number | string | null | undefined,
  code: number,
  message: string,
  data?: unknown
) {
  return {
    jsonrpc: "2.0" as const,
    id: id ?? null,
    error: { code, message, data },
  };
}

async function listMcpTools() {
  const rows = await db
    .select()
    .from(tools)
    .where(eq(tools.visibility, "public"))
    .orderBy(desc(tools.updatedAt));

  const items = await Promise.all(
    rows.map(async (row) => {
      const spec = await loadLatestSpec(row.id, row.latestVersion);
      return {
        name: row.slug,
        description: row.description || row.name,
        inputSchema: (spec?.input as Record<string, unknown>) ?? { type: "object" },
        _meta: {
          version: row.latestVersion,
          endpoint: spec
            ? { method: spec.endpoint.method, url: spec.endpoint.url }
            : undefined,
          auth: spec?.auth.type,
        },
      };
    })
  );

  return { tools: items };
}

async function callMcpTool(params: unknown, caller: Caller) {
  if (!params || typeof params !== "object") {
    throw { code: -32602, message: "Invalid params" };
  }
  const { name, arguments: args } = params as { name?: unknown; arguments?: unknown };
  if (typeof name !== "string") {
    throw { code: -32602, message: "params.name (string) is required" };
  }

  const result = await invokeRegisteredTool(name, args ?? {}, caller);

  // MCP tool/call result shape: { content: [...], isError }
  const isError = result.status >= 400;
  return {
    content: [
      {
        type: "text",
        text:
          typeof result.body === "string"
            ? result.body
            : JSON.stringify(result.body, null, 2),
      },
    ],
    isError,
    _meta: {
      status: result.status,
      durationMs: result.durationMs,
    },
  };
}

async function handle(req: JsonRpcRequest, caller: Caller) {
  try {
    switch (req.method) {
      case "initialize":
        return rpcResult(req.id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions:
            "agent-tools exposes a public registry of HTTP tools. Use tools/list to discover, tools/call to invoke.",
        });
      case "notifications/initialized":
        return null; // notifications never return a response
      case "ping":
        return rpcResult(req.id, {});
      case "tools/list":
        return rpcResult(req.id, await listMcpTools());
      case "tools/call":
        return rpcResult(req.id, await callMcpTool(req.params, caller));
      default:
        return rpcError(req.id, -32601, `Method not found: ${req.method}`);
    }
  } catch (err) {
    // HTTPException from invoke service → translate to JSON-RPC error
    const httpStatus = (err as { status?: number }).status;
    const message = (err as Error).message ?? "Internal error";
    if (typeof httpStatus === "number") {
      return rpcError(req.id, -32000 - httpStatus, message);
    }
    if ((err as { code?: number }).code) {
      return rpcError(req.id, (err as { code: number }).code, message);
    }
    logger.error({ err }, "MCP handler error");
    return rpcError(req.id, -32603, "Internal error");
  }
}

app.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json(rpcError(null, -32700, "Parse error"));
  }
  const caller = c.get("caller");

  // Support both single requests and batches
  if (Array.isArray(body)) {
    const responses = await Promise.all(body.map((req) => handle(req, caller)));
    const filtered = responses.filter((r): r is NonNullable<typeof r> => r !== null);
    return c.json(filtered);
  }
  const result = await handle(body as JsonRpcRequest, caller);
  if (result === null) return c.body(null, 204);
  return c.json(result);
});

// GET / — server descriptor for discovery
app.get("/", (c) =>
  c.json({
    name: SERVER_INFO.name,
    version: SERVER_INFO.version,
    protocolVersion: PROTOCOL_VERSION,
    transport: "http",
    endpoint: "/api/v1/mcp",
    methods: ["initialize", "tools/list", "tools/call", "ping"],
    docs: "https://modelcontextprotocol.io",
  })
);

export default app;

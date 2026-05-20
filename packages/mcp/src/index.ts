#!/usr/bin/env node
/**
 * Stdio MCP server that bridges to an agent-tools HTTP registry.
 *
 * Reads newline-delimited JSON-RPC requests from stdin, forwards them
 * to the registry's /api/v1/mcp endpoint, and writes responses to stdout.
 *
 * Usage (e.g. in Claude Desktop config):
 *   {
 *     "command": "npx",
 *     "args": ["-y", "@agent-tools/mcp"],
 *     "env": { "AGENT_TOOLS_API_URL": "http://localhost:3002",
 *              "AGENT_TOOLS_API_KEY": "at_..." }
 *   }
 */

import readline from "node:readline";

const API_URL = process.env.AGENT_TOOLS_API_URL ?? "http://localhost:3002";
const API_KEY = process.env.AGENT_TOOLS_API_KEY;
const ENDPOINT = `${API_URL.replace(/\/$/, "")}/api/v1/mcp`;

function log(...args: unknown[]) {
  // stderr is reserved for logging in stdio MCP (stdout is the protocol channel)
  process.stderr.write(`[agent-tools-mcp] ${args.map(String).join(" ")}\n`);
}

async function forward(request: unknown): Promise<unknown | null> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (API_KEY) headers.authorization = `Bearer ${API_KEY}`;
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
    });
  } catch (err) {
    log("network error:", (err as Error).message);
    return {
      jsonrpc: "2.0",
      id: (request as { id?: number | string | null }).id ?? null,
      error: { code: -32603, message: `Network error: ${(err as Error).message}` },
    };
  }
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    log("non-JSON response from registry:", text.slice(0, 200));
    return {
      jsonrpc: "2.0",
      id: (request as { id?: number | string | null }).id ?? null,
      error: { code: -32603, message: "Registry returned non-JSON" },
    };
  }
}

function emit(message: unknown) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

const rl = readline.createInterface({ input: process.stdin });

log(`connected to ${ENDPOINT}${API_KEY ? " (authenticated)" : ""}`);

const inflight = new Set<Promise<void>>();

function handleLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return;
  let request: unknown;
  try {
    request = JSON.parse(trimmed);
  } catch (err) {
    log("ignoring non-JSON input:", (err as Error).message);
    return;
  }
  const task = (async () => {
    const response = await forward(request);
    if (response !== null) emit(response);
  })();
  inflight.add(task);
  task.finally(() => inflight.delete(task));
}

rl.on("line", handleLine);

rl.on("close", async () => {
  await Promise.allSettled(inflight);
  process.exit(0);
});

async function shutdown() {
  await Promise.allSettled(inflight);
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

# agent-tools

An open registry of machine-readable tools designed for AI agents to discover and call programmatically — no human in the loop.

Built around three primitives:

- **Tool** — a named, versioned, agent-callable capability (e.g. `acme-send-invoice`).
- **ToolSpec** — the machine-readable contract: input schema, output schema, endpoint, auth requirements.
- **Invoke** — a single `POST /tools/:slug/call` endpoint that proxies the call to the upstream endpoint with the agent's credentials.

Companion to [AgentGate](https://github.com/Jesut0ni/agentgate) — `agent-tools` is what gets called, AgentGate is the auth layer that decides who can call what.

Every tool registered here is also a native [MCP](https://modelcontextprotocol.io) tool, exposed over HTTP at `/api/v1/mcp` and over stdio via `@agent-tools/mcp`.

## Status

v0.6 — auth, ownership, JSON Schema validation, real SSRF guard, rate limiting, CORS lockdown, AgentGate JWT integration, MCP server (HTTP + stdio), OpenAPI importer, 15 passing tests.

## Stack

Hono · Drizzle · SQLite · TypeScript · Turbo workspaces · Zod · Ajv · jose · Next.js 15 · Tailwind.

## Quickstart (dev)

```bash
npm install
npm run db:push
npm run seed       # creates a demo developer + 5 demo tools, prints the API key once
npm run dev        # api on :3002, web on :3000
```

Open `http://localhost:3000`. Sign up at `/signup` to get your own API key (or use the demo key printed by `npm run seed`).

### Publish a tool (curl)

```bash
curl -X POST http://localhost:3002/api/v1/tools \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $AGENT_TOOLS_KEY" \
  -d '{
    "slug": "demo-echo",
    "name": "Echo",
    "description": "Echoes whatever you send it.",
    "version": "0.1.0",
    "spec": {
      "endpoint": { "method": "POST", "url": "https://postman-echo.com/post" },
      "input": { "type": "object", "properties": { "message": { "type": "string" } }, "required": ["message"] },
      "output": { "type": "object" },
      "auth": { "type": "none" }
    }
  }'
```

### Invoke a tool

```bash
curl -X POST http://localhost:3002/api/v1/tools/demo-echo/call \
  -H 'Content-Type: application/json' \
  -d '{ "message": "hello agents" }'
```

### Use it as an MCP server

HTTP transport:

```bash
curl -X POST http://localhost:3002/api/v1/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Stdio bridge (for Claude Desktop / Cursor — see `packages/mcp/README.md`):

```json
{
  "mcpServers": {
    "agent-tools": {
      "command": "npx",
      "args": ["-y", "@agent-tools/mcp"],
      "env": { "AGENT_TOOLS_API_URL": "http://localhost:3002" }
    }
  }
}
```

## Deploying (Docker)

```bash
cp .env.example .env
# edit .env — at minimum set AGENTGATE_JWT_SECRET to a 32+ char secret
docker compose up --build
```

The API refuses to boot in production if `AGENTGATE_JWT_SECRET` still has the dev default.

Data persists in the `agent-tools-data` named volume (sqlite db).

### Postgres path

We use SQLite for v0 (single-writer, fine for low traffic, simple ops). Drizzle's schema can switch to `pgTable` to back the same routes with Postgres when traffic justifies it — that's deliberately out of scope for v0 to keep the deploy story one command.

## Testing

```bash
npm -w @agent-tools/api test
```

15 tests covering: developer signup + duplicate handling, anon/authed publish, ownership-bound delete & version, JSON Schema meta validation, runtime input validation, SSRF (IPv4 + IPv6 literals), AgentGate JWT (missing/bogus/expired/wrong-scope/valid), and MCP initialize/list/unknown-method.

## License

MIT

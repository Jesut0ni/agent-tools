# agent-tools

An open registry of machine-readable tools designed for AI agents to discover and call programmatically — no human in the loop.

Built around three primitives:

- **Tool** — a named, versioned, agent-callable capability (e.g. `acme/send-invoice`).
- **ToolSpec** — the machine-readable contract: input schema, output schema, endpoint, auth requirements.
- **Invoke** — a single `POST /tools/:slug/call` endpoint that proxies the call to the upstream endpoint with the agent's credentials.

Companion to [AgentGate](https://github.com/Jesut0ni/agentgate) — `agent-tools` is what gets called, AgentGate is the auth layer that decides who can call what.

## Status

v0 — single-node, SQLite, no auth. Run locally and curl it. Production-readiness, AgentGate integration, and a Next.js directory UI come next.

## Stack

Hono · Drizzle · SQLite · TypeScript · Turbo workspaces · Zod.

## Quickstart

```bash
npm install
npm run db:push
npm run dev
```

API runs on `http://localhost:3002`.

### Publish a tool

```bash
curl -X POST http://localhost:3002/api/v1/tools \
  -H 'Content-Type: application/json' \
  -d '{
    "slug": "demo-echo",
    "name": "Echo",
    "description": "Echoes whatever you send it.",
    "version": "0.1.0",
    "spec": {
      "endpoint": { "method": "POST", "url": "https://postman-echo.com/post" },
      "input": { "type": "object", "properties": { "message": { "type": "string" } } },
      "output": { "type": "object" },
      "auth": { "type": "none" }
    }
  }'
```

### List tools

```bash
curl http://localhost:3002/api/v1/tools
```

### Invoke a tool

```bash
curl -X POST http://localhost:3002/api/v1/tools/demo-echo/call \
  -H 'Content-Type: application/json' \
  -d '{ "message": "hello agents" }'
```

## License

MIT

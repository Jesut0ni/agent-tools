# Launch assets — agent-tools

Draft copy for v0 launch. Paste directly or tweak. Keep tone factual; no hype.

---

## 1. Show HN

**Title** (80 char max — HN cuts off long titles):

> Show HN: Agent-tools – open registry of MCP-callable tools for AI agents

**Body:**

```
Hey HN — I built agent-tools, an open registry where developers publish
typed, versioned tools that AI agents can discover and call via either
HTTP or the Model Context Protocol (MCP).

The pitch in one diagram:

  Agent → /api/v1/tools/:slug/call → upstream API

Every registered tool is:
  • A native MCP tool (HTTP at /api/v1/mcp + stdio bridge for
    Claude Desktop / Cursor)
  • Validated against its JSON Schema on every invocation
  • Behind a real SSRF guard (dns.lookup all + RFC1918 + IPv6 ULA)
  • Rate-limited per route, audited per call
  • Optionally gated by AgentGate JWT scopes

It’s built around a single ToolSpec contract — endpoint, input schema,
output schema, auth requirement, examples. Once that’s pinned, the
registry handles discovery, proxy, validation, abuse limits, and audit.

Why this exists: YC RFS S26 explicitly asked for "machine-readable
interfaces and tools specifically designed for AI agents to use
programmatically." Today every agent maker reinvents that surface
privately. Agent-tools is the smallest viable shared version.

Stack: Hono + Drizzle + SQLite (Postgres path documented), Next.js 15,
Ajv, jose, native MCP. 23 vitest specs, all passing. Docker compose
deploys in one command.

Repo: https://github.com/Jesut0ni/agent-tools
Docs: https://github.com/Jesut0ni/agent-tools/blob/main/AgentTools_Documentation.doc

Companion to AgentGate (https://github.com/Jesut0ni/agentgate) — together
they cover "what agents can call" and "who can call it."

Honest about gaps in the README + roadmap: in-memory rate limit,
no Postgres yet, no real email provider wired, no live demo URL yet.
Happy to take feedback on any of it.
```

**Why this works:** factual, leads with the problem, names the gaps (HN voters reward honesty), single-paragraph hook. Avoid emoji and exclamation points.

---

## 2. X / Twitter

### Option A — single tweet (start here)

```
Built agent-tools: an open registry where you publish typed tools once
and they’re automatically callable by any agent over MCP (HTTP + stdio).

JSON Schema validation, real SSRF guard, audit log, AgentGate JWT auth.

23 tests passing. Public on GitHub:
https://github.com/Jesut0ni/agent-tools
```

### Option B — thread (better engagement)

```
1/  AI agents are only useful to the extent they can do things in the
    real world. Today every agent maker reinvents how it discovers and
    calls tools privately.

    I built agent-tools to fix that.
    https://github.com/Jesut0ni/agent-tools

2/  Publish a tool once with a ToolSpec — endpoint, input schema,
    output schema, auth requirement.

    The registry then exposes it three ways:
    • REST: POST /api/v1/tools/:slug/call
    • MCP over HTTP at /api/v1/mcp
    • Stdio MCP for Claude Desktop / Cursor

    [screenshot of directory]

3/  Security wasn’t bolted on:

    – Real DNS-resolving SSRF guard (all A/AAAA, RFC1918, IPv6 ULA)
    – Ajv JSON Schema validation at publish + invoke
    – Per-developer tool + daily call caps
    – Audit log of every invocation
    – CORS lockdown, rate limit, env hardening

4/  AgentGate integration: a tool can require
    auth: { type: "agentgate", scopes: ["tools:call"] }

    The proxy verifies the caller's JWT (HS256 with the shared secret)
    and enforces the scopes before forwarding upstream.

5/  v0.7 — 23 vitest specs pass, dockerized, migrations on boot.

    Gaps I’m calling out: no live demo URL yet, in-memory rate limit,
    no real email provider wired. All on the roadmap.

    Feedback welcome.
    https://github.com/Jesut0ni/agent-tools
```

### What to attach (high leverage):

A 20–40 second screen recording showing:
1. The directory page at `localhost:3000`
2. Click into `weather-now`
3. Hit "Invoke" — show the JSON response
4. Show the curl/TS snippet panel

Tools: macOS built-in (Cmd+Shift+5 → "Record selected portion") or Quicktime.
Trim in QuickTime Player → File → Export As → 1080p. Upload directly to
X (not a link).

---

## 3. r/LocalLLaMA (Reddit)

```
Title: Open registry for MCP-callable tools — every tool you publish
       becomes available to Claude Desktop / Cursor / any MCP client

Body:
I’ve been frustrated that adding a new tool to my agent setup means
hand-coding an MCP server every time. So I built agent-tools — a
registry where you publish a typed spec once and the system exposes it
as a native MCP tool automatically.

What it does:
• Publish: send a ToolSpec (endpoint + JSON Schema for input/output +
  auth requirement). Get back a tool that’s immediately listed in
  GET /api/v1/mcp tools/list.
• Stdio bridge: there’s an npx-able MCP server you can drop into your
  client config — Claude Desktop, Cursor, anything that speaks stdio MCP.
• Proxy: invocations go through one endpoint with SSRF guard, schema
  validation, rate limiting, audit log.
• Optional auth: if a tool requires an AgentGate-issued JWT with
  specific scopes, the proxy verifies it before forwarding.

There are 5 seeded demo tools (weather, public-ip, joke, echo, httpbin)
you can browse + invoke in the included Next.js UI.

Stack: Hono + Drizzle + SQLite, Next 15, Ajv, jose. MIT.

Repo: https://github.com/Jesut0ni/agent-tools

Happy to answer questions — also looking for feedback on the ToolSpec
format and what kinds of tools you’d actually publish.
```

---

## 4. MCP Discord (`#showcase` or `#general`)

```
Hey — sharing a project that's directly in MCP territory:

agent-tools — an open registry where you publish typed tools once and
they’re automatically exposed as MCP tools (both HTTP at /api/v1/mcp
and a stdio bridge via @agent-tools/mcp for Claude Desktop / Cursor).

The idea: stop hand-coding individual MCP servers. Publish a ToolSpec
(endpoint + JSON Schema in/out + auth requirement) and the registry
handles MCP plumbing, validation, proxy, audit, and abuse limits.

5 demo tools seeded, ~23 tests, MIT, public on GitHub:
https://github.com/Jesut0ni/agent-tools

Would love feedback from people who’ve been building MCP servers — am
I missing important MCP capabilities (resources, prompts, sampling)?
Currently I just implement tools/{list,call} + initialize + ping.
```

---

## Sequencing recommendation

If you’re only going to do one channel today: **Show HN**.
- Posts well between 8–11am ET on Mon/Tue/Wed
- HN audience cares about MCP and developer tools
- The repo + README do most of the convincing

After ~24h, do the X thread (Option B) with the screen recording.

Skip Reddit + Discord until you have at least one of: HN traction, a
live demo URL, or an integrator success story. Cold posts in
communities are usually ignored or downvoted.

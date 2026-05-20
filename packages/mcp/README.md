# @agent-tools/mcp

Stdio MCP server that exposes an [agent-tools](https://github.com/Jesut0ni/agent-tools) registry to MCP clients (Claude Desktop, Cursor, etc.).

## Usage

In your MCP client config (e.g. Claude Desktop's `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "agent-tools": {
      "command": "npx",
      "args": ["-y", "@agent-tools/mcp"],
      "env": {
        "AGENT_TOOLS_API_URL": "http://localhost:3002",
        "AGENT_TOOLS_API_KEY": "at_..."
      }
    }
  }
}
```

The `AGENT_TOOLS_API_KEY` is only required if you want to call tools that use `agentgate` auth, or to surface ownership-bound features. Public tool browsing works without it.

## What it does

Reads newline-delimited JSON-RPC messages from stdin, POSTs them to the registry's `/api/v1/mcp` endpoint, and writes responses to stdout. That's it — the registry handles the actual MCP semantics (`initialize`, `tools/list`, `tools/call`).

## License

MIT

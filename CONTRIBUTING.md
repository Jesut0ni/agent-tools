# Contributing to agent-tools

Thanks for your interest! agent-tools is an open registry of machine-readable tools for AI agents. Pull requests, issues, and ideas are all welcome.

## Getting Started

1. **Fork** the repo on GitHub.
2. **Clone** your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/agent-tools.git
   cd agent-tools
   ```
3. **Install** dependencies:
   ```bash
   npm install
   ```
4. **Run** the dev servers (api on `:3002`, web on `:3000`; migrations apply automatically):
   ```bash
   npm run dev
   ```
5. **Seed** demo data (optional — creates `demo@agent-tools.local` + 5 sample tools and prints an API key):
   ```bash
   npm run seed
   ```

Open <http://localhost:3000> and you have a working local copy.

## Project Structure

```
packages/
├── shared/   → Zod schemas + TS types (the ToolSpec contract)
├── api/      → Hono REST + MCP server + invoke proxy
├── web/      → Next.js 15 directory + publish + signup + import
└── mcp/      → Stdio MCP bridge for Claude Desktop / Cursor
```

## Making Changes

1. Create a branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes.
3. Run the tests:
   ```bash
   npm -w @agent-tools/api test
   ```
4. Make sure everything builds:
   ```bash
   npm -w @agent-tools/shared run build
   npm -w @agent-tools/api run build
   npm -w @agent-tools/web run build
   ```
5. Commit and push:
   ```bash
   git add .
   git commit -m "Brief description of change"
   git push origin feature/your-feature-name
   ```
6. Open a Pull Request on GitHub. CI will run automatically.

## What to Work On

Check the [Issues](https://github.com/Jesut0ni/agent-tools/issues) tab for open tasks. Some good directions:

### Good first issues
- Add more seed tools (Stripe, GitHub, Notion — anything with a public REST API and no auth complexity)
- Polish mobile responsiveness on the directory and detail pages
- Add OG / Twitter share images per tool
- Surface daily-call stats on each tool's detail page (we already write them to the `invocations` table)
- Write more tests around edge cases

### Medium
- `packages/sdk` — a typed TS client so agents don't hand-roll fetch + JSON-RPC
- Path-templating support in proxy URLs (`/pets/{id}` with input-driven substitution)
- Real email provider integration (Resend, Postmark) for the verification flow
- Admin endpoints to suspend/unsuspend developers
- API key rotation endpoint + UI
- Swagger 2.0 importer (currently OpenAPI 3.x only)
- "Import from curl" — paste a curl command, get a tool spec

### Advanced
- Redis-backed rate limit + abuse counter store
- Postgres support (`pgTable` mirror schemas + dialect switch)
- MCP `resources/` for tool documentation
- MCP `prompts/` for tool-specific call templates
- Streamable HTTP MCP transport (server-initiated notifications via SSE)
- Verified-publisher badges (domain-ownership challenge or org-level KYC)

## Code Style

- TypeScript strict mode everywhere
- All input validation goes through Zod at the API boundary
- JSON Schemas validated with Ajv (draft-07)
- Keep route handlers thin — heavy work lives in `services/`
- IDs use `@paralleldrive/cuid2` (`createId()`)
- Dates stored as `mode: "timestamp"` integers (Drizzle handles the conversion)
- Hono `HTTPException` for all error responses with a status

## Pull Request Guidelines

- One feature or fix per PR
- Include a short description of *what* changed and *why*
- Add tests for new behaviour
- Don't break existing tests
- Update the `README.md` or `AgentTools_Documentation.doc` if you add new endpoints or env vars

## Database Schema Changes

If you change anything in `packages/api/src/db/schema/`, generate a migration:

```bash
cd packages/api && npx drizzle-kit generate
```

Commit the new SQL file under `src/db/migrations/`. The API runs `migrate()` on boot, so a freshly cloned repo plus your migration will end up with the correct schema.

## Questions

Open an issue or start a discussion. No question is too small. If you're not sure whether a change is welcome before doing the work, file an issue describing your idea first.

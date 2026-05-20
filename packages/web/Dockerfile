# --- deps ---
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/
COPY packages/mcp/package.json ./packages/mcp/
RUN npm ci --ignore-scripts

# --- build ---
FROM deps AS build
ARG NEXT_PUBLIC_AGENT_TOOLS_API_URL=http://localhost:3002
ENV NEXT_PUBLIC_AGENT_TOOLS_API_URL=$NEXT_PUBLIC_AGENT_TOOLS_API_URL
COPY packages/shared ./packages/shared
COPY packages/web ./packages/web
RUN npm -w @agent-tools/web run build

# --- runtime ---
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN useradd --create-home --shell /bin/sh app && chown -R app:app /app
COPY --from=deps  --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/packages/shared ./packages/shared
COPY --from=build --chown=app:app /app/packages/web/package.json ./packages/web/package.json
COPY --from=build --chown=app:app /app/packages/web/.next ./packages/web/.next
COPY --chown=app:app package.json ./
USER app
EXPOSE 3000
WORKDIR /app/packages/web
CMD ["npx", "--no-install", "next", "start", "-p", "3000"]

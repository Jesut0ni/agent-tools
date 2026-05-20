# --- deps (with native build tools for better-sqlite3) ---
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/
COPY packages/mcp/package.json ./packages/mcp/
RUN npm ci --ignore-scripts \
  && npm rebuild better-sqlite3

# --- build ---
FROM deps AS build
COPY packages/shared ./packages/shared
COPY packages/api ./packages/api
RUN npm -w @agent-tools/shared run build \
  && npm -w @agent-tools/api run build
# Repoint shared's main at the compiled output for runtime (dev points at TS source).
RUN node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('packages/shared/package.json','utf8')); p.main='./dist/index.js'; p.types='./dist/index.d.ts'; p.exports={'.': './dist/index.js'}; fs.writeFileSync('packages/shared/package.json', JSON.stringify(p,null,2));"

# --- runtime (slim, no toolchain) ---
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    DATABASE_PATH=/data/agent-tools.db \
    API_PORT=3002
RUN useradd --create-home --shell /bin/sh app \
  && mkdir -p /data \
  && chown -R app:app /data /app
COPY --from=deps  --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build --chown=app:app /app/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=app:app /app/packages/api/package.json ./packages/api/package.json
COPY --from=build --chown=app:app /app/packages/api/dist ./packages/api/dist
COPY --from=build --chown=app:app /app/packages/api/src/db/migrations ./packages/api/src/db/migrations
COPY --chown=app:app package.json ./
USER app
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||3002)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "packages/api/dist/index.js"]

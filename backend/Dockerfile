# Backend Dockerfile that works with both Railway root_dir=backend and root_dir=repo
# Stage 1: build frontend when context includes it (e.g. repo root)
FROM node:22-alpine AS frontend-builder
WORKDIR /build
COPY . /tmp/context
RUN set -eux; \
  if [ -f /tmp/context/frontend/package.json ]; then \
    cd /tmp/context/frontend && npm ci && npm run build; \
  else \
    mkdir -p /tmp/context/frontend/dist; \
  fi

# Stage 2: backend runtime
FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init

# Copy the available build context (could be repo root or backend root)
COPY . /tmp/context

# Normalize layout to /app as backend project root; copy built frontend into public
RUN set -eux; \
    if [ -f /tmp/context/backend/package.json ]; then SRC=/tmp/context/backend; else SRC=/tmp/context; fi; \
    cp "$SRC"/package*.json /app/; \
    mkdir -p /app/src /app/docs /app/migrations /app/downloads /app/public; \
    if [ -d "$SRC/src" ]; then cp -R "$SRC/src/." /app/src/; fi; \
    if [ -d "$SRC/docs" ]; then cp -R "$SRC/docs/." /app/docs/; fi; \
    if [ -d "$SRC/migrations" ]; then cp -R "$SRC/migrations/." /app/migrations/; fi; \
    if [ -d "$SRC/downloads" ]; then cp -R "$SRC/downloads/." /app/downloads/; fi
COPY --from=frontend-builder /tmp/context/frontend/dist /app/public

RUN npm ci --omit=dev

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
# One entrypoint: run web or worker based on RAILWAY_PROCESS (set worker service to RAILWAY_PROCESS=worker)
CMD ["node", "src/railway-entrypoint.js"]

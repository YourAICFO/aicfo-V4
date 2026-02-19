# Backend Dockerfile that works with both Railway root_dir=backend and root_dir=repo
FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init

# Copy the available build context (could be repo root or backend root)
COPY . /tmp/context

# Normalize layout to /app as backend project root
RUN set -eux; \
    if [ -f /tmp/context/backend/package.json ]; then SRC=/tmp/context/backend; else SRC=/tmp/context; fi; \
    cp "$SRC"/package*.json /app/; \
    mkdir -p /app/src /app/docs /app/migrations /app/downloads /app/public; \
    if [ -d "$SRC/src" ]; then cp -R "$SRC/src/." /app/src/; fi; \
    if [ -d "$SRC/docs" ]; then cp -R "$SRC/docs/." /app/docs/; fi; \
    if [ -d "$SRC/migrations" ]; then cp -R "$SRC/migrations/." /app/migrations/; fi; \
    if [ -d "$SRC/downloads" ]; then cp -R "$SRC/downloads/." /app/downloads/; fi

RUN npm ci --omit=dev

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
# One entrypoint: run web or worker based on RAILWAY_PROCESS (set worker service to RAILWAY_PROCESS=worker)
CMD ["node", "src/railway-entrypoint.js"]

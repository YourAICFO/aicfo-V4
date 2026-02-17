# Backend-only Dockerfile for Railway deployment (root_dir=backend compatible)
FROM node:22-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package metadata and install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy backend source tree
COPY src ./src
COPY docs ./docs
COPY migrations ./migrations
COPY downloads ./downloads

# Keep startup behavior consistent for frontend static serving fallback
RUN mkdir -p public

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]

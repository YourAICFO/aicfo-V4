# Root-level Dockerfile for AI CFO Platform monorepo
# Fixes "cd: frontend: No such file or directory" by using correct paths from repo root

# Stage 1: Frontend Builder - Install ALL dependencies including dev/build deps
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files first for better layer caching
COPY frontend/package*.json ./

# Install ALL dependencies (including devDependencies needed for build)
RUN npm ci

# Copy entire frontend source after dependencies are installed
COPY frontend/ ./

# Build frontend (now with all PostCSS/Tailwind deps available)
RUN npm run build

# Stage 2: Backend Builder - Production dependencies only  
FROM node:18-alpine AS backend-builder

WORKDIR /app/backend

# Copy backend package files
COPY backend/package*.json ./

# Install production dependencies only (runtime deps)
RUN npm ci --omit=dev

# Stage 3: Production Runtime
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory structure
WORKDIR /app

# Copy backend from builder stage (production deps only)
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/backend/package*.json ./backend/

# Copy backend source code
COPY backend/src ./backend/src
COPY backend/docs ./backend/docs
COPY backend/migrations ./backend/migrations
COPY backend/downloads ./backend/downloads

# Copy built frontend dist to backend public folder
COPY --from=frontend-builder /app/frontend/dist ./backend/public

# Set permissions and switch to non-root user
RUN chown -R node:node /app
USER node

# Set working directory to backend
WORKDIR /app/backend

# Expose port (Railway uses $PORT)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the backend application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
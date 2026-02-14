# Multi-stage Dockerfile for AI CFO Platform
# This ignores the .NET connector and focuses on Node.js/React stack

# Stage 1: Build Frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./
COPY frontend/vite.config.ts ./
COPY frontend/tsconfig*.json ./
COPY frontend/tailwind.config.js ./
COPY frontend/postcss.config.js ./

# Install frontend dependencies
RUN npm ci --only=production

# Copy frontend source code
COPY frontend/src ./src
COPY frontend/index.html ./index.html
COPY frontend/src/index.css ./src/index.css

# Build frontend
RUN npm run build

# Stage 2: Setup Backend
FROM node:18-alpine AS backend-builder

WORKDIR /app/backend

# Copy backend package files
COPY backend/package*.json ./

# Install backend dependencies
RUN npm ci --only=production

# Stage 3: Final Production Image
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Copy backend from builder stage
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/backend/package*.json ./backend/

# Copy backend source code (excluding .NET connector)
COPY backend/src ./backend/src
COPY backend/docs ./backend/docs
COPY backend/migrations ./backend/migrations
COPY backend/downloads ./backend/downloads

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create downloads directory for connector
RUN mkdir -p /app/backend/downloads && \
    chown -R node:node /app

# Switch to non-root user
USER node

# Set working directory to backend
WORKDIR /app/backend

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
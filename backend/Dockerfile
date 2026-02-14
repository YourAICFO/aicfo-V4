# Backend-only Dockerfile for Railway deployment
# Simplified version for better compatibility

FROM node:18

# Create app directory
WORKDIR /app

# Copy backend package files
COPY package*.json ./

# Install production dependencies only (runtime deps)
RUN npm ci --omit=dev

# Copy backend source code
COPY src ./src
COPY docs ./docs
COPY migrations ./migrations
COPY downloads ./downloads

# Create public directory for any static files (if needed)
RUN mkdir -p public

# Use node user (already exists in node:18 image)
USER node

# Expose port (Railway uses $PORT)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the backend application directly
CMD ["node", "src/server.js"]
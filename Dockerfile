# Use Node.js 20 as specified in package.json
FROM node:20-slim

# Install Redis, curl for healthcheck, and other utilities
RUN apt-get update && apt-get install -y redis-server curl procps net-tools && rm -rf /var/lib/apt/lists/*

# Configure Redis
RUN mkdir -p /var/run/redis && \
    chown redis:redis /var/run/redis && \
    chmod 750 /var/run/redis && \
    echo "bind 0.0.0.0" >> /etc/redis/redis.conf && \
    echo "protected-mode no" >> /etc/redis/redis.conf

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Make startup script executable
RUN chmod +x scripts/startup.sh

# Build the application
RUN npm run build:ws

# Use Railway's PORT environment variable or fallback to 8080
ENV PORT=8080
ENV WS_HOST=0.0.0.0

# Expose PORT explicitly for clarity
EXPOSE 8080

# Add healthcheck with more reliability
HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || curl -f http://0.0.0.0:${PORT}/health || exit 1

# Start Redis and the WebSocket server using our startup script
CMD ["./scripts/startup.sh"] 
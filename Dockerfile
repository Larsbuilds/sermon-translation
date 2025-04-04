# Use Node.js 20 as specified in package.json
FROM node:20-slim

# Install Redis, curl for healthcheck, and other utilities
RUN apt-get update && apt-get install -y redis-server curl procps && rm -rf /var/lib/apt/lists/*

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

# Expose WebSocket port
EXPOSE 3002

# Add healthcheck
HEALTHCHECK --interval=10s --timeout=30s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

# Start Redis and the WebSocket server using our startup script
CMD ["./scripts/startup.sh"] 
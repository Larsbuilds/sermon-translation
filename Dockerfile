# Use Node.js 20 as specified in package.json
FROM node:20-slim

# Install Redis, curl for healthcheck, and other utilities
RUN apt-get update && apt-get install -y \
    redis-server \
    curl \
    procps \
    net-tools \
    lsof \
    iproute2 \
    iputils-ping \
    netcat-openbsd \
    socat \
    python3-minimal \
    && rm -rf /var/lib/apt/lists/*

# Configure Redis for reliability
RUN mkdir -p /var/run/redis && \
    chown redis:redis /var/run/redis && \
    chmod 750 /var/run/redis && \
    sed -i 's/bind 127.0.0.1/bind 0.0.0.0/g' /etc/redis/redis.conf && \
    echo "protected-mode no" >> /etc/redis/redis.conf && \
    echo "maxmemory 128mb" >> /etc/redis/redis.conf && \
    echo "maxmemory-policy allkeys-lru" >> /etc/redis/redis.conf && \
    echo "appendonly yes" >> /etc/redis/redis.conf && \
    echo "appendfsync everysec" >> /etc/redis/redis.conf && \
    echo "timeout 0" >> /etc/redis/redis.conf && \
    echo "tcp-keepalive 300" >> /etc/redis/redis.conf && \
    echo "port 6379" >> /etc/redis/redis.conf

# Create data directory for Redis
RUN mkdir -p /data && chown redis:redis /data

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

# Set to production mode
ENV NODE_ENV=production

# Use Railway's PORT environment variable or fallback to 8080
ENV PORT=8080
ENV WS_HOST=0.0.0.0
# Default Redis URL for local development - will be overridden by Railway in production
ENV REDIS_URL=redis://localhost:6379

# Expose ports explicitly
EXPOSE 8080
EXPOSE 8081
EXPOSE 6379

# Add healthcheck with more reliability - use dedicated health port
HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8081/health || curl -f http://localhost:8081/ || exit 1

# Start Redis and the WebSocket server using our startup script
CMD ["./scripts/startup.sh"] 
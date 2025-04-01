# Use Node.js 20 as specified in package.json
FROM node:20-slim

# Install Redis and curl for healthcheck
RUN apt-get update && apt-get install -y redis-server curl && rm -rf /var/lib/apt/lists/*

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

# Build the application
RUN npm run build:ws

# Expose ports
EXPOSE 3000 3001

# Add healthcheck
HEALTHCHECK --interval=10s --timeout=30s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start Redis and the application
CMD ["sh", "-c", "redis-server --daemonize yes && sleep 5 && npm run start"] 
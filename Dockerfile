# Use Node.js 20 as specified in package.json
FROM node:20-slim

# Install Redis
RUN apt-get update && apt-get install -y redis-server && rm -rf /var/lib/apt/lists/*

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

# Start Redis and the application
CMD ["sh", "-c", "redis-server --daemonize yes && npm run start"] 
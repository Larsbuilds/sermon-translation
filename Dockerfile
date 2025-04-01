# Use Node.js 18 as specified in our package.json
FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the WebSocket server
RUN npm run build:ws

# Set environment variables
ENV NODE_ENV=production
ENV WS_PORT=3001
ENV WS_HOST=0.0.0.0
ENV NODE_OPTIONS=--experimental-specifier-resolution=node

# Expose the WebSocket port
EXPOSE 3001

# Start the server
CMD ["npm", "run", "ws:prod"] 
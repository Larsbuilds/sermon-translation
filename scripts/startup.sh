#!/bin/bash
set -e

echo "Environment Information:"
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "WS_PORT: $WS_PORT"
echo "WS_HOST: $WS_HOST"
echo "REDIS_URL: $REDIS_URL"

echo "Starting Redis server..."
redis-server --daemonize yes

echo "Waiting for Redis to start..."
sleep 3

echo "Checking Redis status..."
redis-cli ping || echo "Redis not responding, but continuing..."

echo "Starting WebSocket server..."
node --experimental-specifier-resolution=node dist/server/websocket.js &
SERVER_PID=$!

echo "Waiting for WebSocket server to initialize (10 seconds)..."
sleep 10

echo "Checking if WebSocket server is running..."
if ps -p $SERVER_PID > /dev/null; then
    echo "WebSocket server is running with PID: $SERVER_PID"
else
    echo "WebSocket server failed to start. Check logs."
    exit 1
fi

echo "Checking health endpoint..."
curl -v http://localhost:8080/health || echo "Health endpoint not responding yet, but continuing..."

echo "Checking if port 8080 is in use..."
netstat -tuln | grep 8080 || echo "Port 8080 not found in netstat"

echo "Startup complete, keeping container running"
# Keep the container running by waiting for the server process
wait $SERVER_PID 
#!/bin/bash
set -e

echo "Environment Information:"
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "WS_PORT: $WS_PORT"
echo "WS_HOST: $WS_HOST"
echo "REDIS_URL: $REDIS_URL"

# Railway provides PORT environment variable, don't override it
export PORT=${PORT:-8080}
echo "Using PORT: $PORT"

echo "Starting Redis server..."
redis-server --daemonize yes

echo "Waiting for Redis to start..."
sleep 5

echo "Checking Redis status..."
redis-cli ping || echo "Redis not responding, but continuing..."

echo "Starting WebSocket server..."
node --experimental-specifier-resolution=node dist/server/websocket.js &
SERVER_PID=$!

echo "Waiting for WebSocket server to initialize (30 seconds)..."
sleep 30

echo "Checking if WebSocket server is running..."
if ps -p $SERVER_PID > /dev/null; then
    echo "WebSocket server is running with PID: $SERVER_PID"
else
    echo "WebSocket server failed to start. Check logs."
    exit 1
fi

echo "Checking health endpoint..."
curl -v http://localhost:$PORT/health || echo "Health endpoint not responding yet, but continuing..."

echo "Checking 0.0.0.0 health endpoint..."
curl -v http://0.0.0.0:$PORT/health || echo "0.0.0.0 health endpoint not responding, but continuing..."

echo "Checking if port $PORT is in use..."
netstat -tuln | grep $PORT || echo "Port $PORT not found in netstat"

echo "Checking process info..."
ps -ef | grep node || echo "No node processes found"

echo "Checking listen ports..."
netstat -tuln || echo "No listening ports found"

echo "Startup complete, keeping container running"
# Keep the container running by waiting for the server process
wait $SERVER_PID 
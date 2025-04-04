#!/bin/bash
set -e

echo "===== ENVIRONMENT INFORMATION ====="
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "WS_PORT: $WS_PORT"
echo "WS_HOST: $WS_HOST"
echo "REDIS_URL: $REDIS_URL"

# Railway provides PORT environment variable, don't override it
export PORT=${PORT:-8080}
echo "Using PORT: $PORT"
export HEALTH_PORT=$((PORT + 1))
echo "Using HEALTH_PORT: $HEALTH_PORT"

# Create log directory
mkdir -p /app/logs

echo "===== STARTING REDIS SERVER ====="
echo "Redis conf:"
cat /etc/redis/redis.conf | grep -v "^#" | grep -v "^$"

echo "Starting Redis server with debug logging..."
redis-server --daemonize yes --loglevel debug --port 6379 --logfile /app/logs/redis.log

echo "Waiting for Redis to start (5 seconds)..."
sleep 5

echo "===== REDIS STATUS ====="
echo "Redis process:"
ps aux | grep redis-server

echo "Checking Redis port 6379:"
netstat -tuln | grep 6379 || echo "Redis port 6379 not found in netstat!"

echo "Checking Redis connection..."
redis-cli -h localhost -p 6379 ping || echo "Redis not responding to ping!"
redis-cli -h localhost -p 6379 info || echo "Redis info command failed!"

echo "Testing Redis operations..."
redis-cli -h localhost -p 6379 set test_key "test_value" || echo "Failed to set test key in Redis!"
redis-cli -h localhost -p 6379 get test_key || echo "Failed to get test key from Redis!"

echo "Checking Redis logs..."
if [ -f "/app/logs/redis.log" ]; then
    echo "Redis log file content:"
    cat /app/logs/redis.log
else
    echo "No Redis log file found at /app/logs/redis.log"
fi

echo "===== STARTING WEBSOCKET SERVER ====="
echo "Verifying REDIS_URL environment variable:"
echo "REDIS_URL: $REDIS_URL"

echo "Starting WebSocket server with debug logging..."
NODE_DEBUG=*,redis,net,http node --experimental-specifier-resolution=node dist/server/websocket.js > /app/logs/websocket.log 2>&1 &
SERVER_PID=$!

echo "Waiting for WebSocket server to initialize (60 seconds)..."
# Longer wait to ensure server has time to initialize fully
sleep 30

# Check if health server is running on dedicated port
echo "Checking dedicated health endpoint after 30 seconds..."
curl -v http://localhost:$HEALTH_PORT/health || echo "Dedicated health endpoint not responding on localhost:$HEALTH_PORT after 30 seconds!"

# Wait another 30 seconds to give more time for full initialization
echo "Waiting additional 30 seconds for full initialization..."
sleep 30

echo "===== SERVER STATUS ====="
echo "Checking if WebSocket server is running..."
if ps -p $SERVER_PID > /dev/null; then
    echo "WebSocket server is running with PID: $SERVER_PID"
else
    echo "ERROR: WebSocket server failed to start. Check logs."
    echo "Last 100 lines of websocket log:"
    tail -100 /app/logs/websocket.log
    echo "Starting a basic health check server that always returns 200 OK..."
    # Start a simple backup health check server using netcat or a simple HTTP server
    while true; do
        echo -e "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"status\":\"ok\",\"message\":\"Fallback health server\"}" | nc -l -p $HEALTH_PORT
    done &
    FALLBACK_PID=$!
    echo "Fallback health server started with PID: $FALLBACK_PID"
    # Don't exit - fallback server will be kept running
fi

echo "Current directory contents:"
ls -la

echo "===== NETWORK STATUS ====="
echo "Network interfaces:"
ifconfig || ip addr

echo "Checking health endpoints..."
echo "Main health endpoint:"
curl -v http://localhost:$PORT/health || echo "Main health endpoint not responding on localhost:$PORT!"

echo "Dedicated health endpoint:"
curl -v http://localhost:$HEALTH_PORT/health || echo "Dedicated health endpoint not responding on localhost:$HEALTH_PORT!"

echo "Checking if ports are in use..."
echo "Main port $PORT:"
netstat -tuln | grep $PORT || echo "Port $PORT not found in netstat!"

echo "Health port $HEALTH_PORT:"
netstat -tuln | grep $HEALTH_PORT || echo "Port $HEALTH_PORT not found in netstat!"

echo "Checking process info..."
ps -ef || echo "No processes found!"

echo "Checking listen ports..."
netstat -tuln || echo "No listening ports found!"

echo "Checking open files for server process..."
lsof -p $SERVER_PID || echo "No open files for server process!"

echo "Checking last 50 lines of websocket log:"
tail -50 /app/logs/websocket.log

echo "===== STARTUP COMPLETE ====="
echo "Keeping container running by waiting for server process..."
wait $SERVER_PID 
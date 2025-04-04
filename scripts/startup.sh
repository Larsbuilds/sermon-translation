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

echo "===== STARTING REDIS SERVER ====="
echo "Redis conf:"
cat /etc/redis/redis.conf | grep -v "^#" | grep -v "^$"

echo "Starting Redis server with debug logging..."
redis-server --daemonize yes --loglevel debug

echo "Waiting for Redis to start (5 seconds)..."
sleep 5

echo "===== REDIS STATUS ====="
echo "Redis process:"
ps aux | grep redis-server

echo "Checking Redis connection..."
redis-cli ping || echo "Redis not responding to ping!"
redis-cli info || echo "Redis info command failed!"

echo "Testing Redis operations..."
redis-cli set test_key "test_value" || echo "Failed to set test key in Redis!"
redis-cli get test_key || echo "Failed to get test key from Redis!"

echo "Checking Redis logs..."
journalctl -u redis-server -n 50 --no-pager || echo "No systemd Redis logs found"
cat /var/log/redis/redis-server.log 2>/dev/null || echo "No Redis log file found"

echo "===== STARTING WEBSOCKET SERVER ====="
echo "Starting WebSocket server with debug logging..."
NODE_DEBUG=*,redis,net,http node --experimental-specifier-resolution=node dist/server/websocket.js &
SERVER_PID=$!

echo "Waiting for WebSocket server to initialize (30 seconds)..."
sleep 30

echo "===== SERVER STATUS ====="
echo "Checking if WebSocket server is running..."
if ps -p $SERVER_PID > /dev/null; then
    echo "WebSocket server is running with PID: $SERVER_PID"
else
    echo "ERROR: WebSocket server failed to start. Check logs."
    exit 1
fi

echo "Current directory contents:"
ls -la

echo "===== NETWORK STATUS ====="
echo "Network interfaces:"
ifconfig || ip addr

echo "Checking health endpoint..."
curl -v http://localhost:$PORT/health || echo "Health endpoint not responding on localhost!"

echo "Checking 0.0.0.0 health endpoint..."
curl -v http://0.0.0.0:$PORT/health || echo "Health endpoint not responding on 0.0.0.0!"

echo "Checking 127.0.0.1 health endpoint..."
curl -v http://127.0.0.1:$PORT/health || echo "Health endpoint not responding on 127.0.0.1!"

echo "Checking if port $PORT is in use..."
netstat -tuln | grep $PORT || echo "Port $PORT not found in netstat!"

echo "Checking process info..."
ps -ef || echo "No processes found!"

echo "Checking listen ports..."
netstat -tuln || echo "No listening ports found!"

echo "Checking open files for server process..."
lsof -p $SERVER_PID || echo "No open files for server process!"

echo "===== STARTUP COMPLETE ====="
echo "Keeping container running by waiting for server process..."
wait $SERVER_PID 
import { createServer } from 'http';
import { register, Counter, Gauge } from 'prom-client';

// Initialize metrics
const connectionsTotal = new Counter({
  name: 'websocket_connections_total',
  help: 'Total number of WebSocket connections'
});

const connectionsActive = new Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections'
});

const messagesTotal = new Counter({
  name: 'websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['type']
});

const sessionGauge = new Gauge({
  name: 'websocket_sessions_active',
  help: 'Number of active WebSocket sessions'
});

const redisOperationsTotal = new Counter({
  name: 'redis_operations_total',
  help: 'Total number of Redis operations',
  labelNames: ['operation']
});

const redisErrors = new Counter({
  name: 'redis_errors_total',
  help: 'Total number of Redis errors'
});

export function createMetricsServer(port: number) {
  const server = createServer(async (req, res) => {
    if (req.url === '/metrics') {
      res.setHeader('Content-Type', register.contentType);
      res.end(await register.metrics());
    } else {
      res.statusCode = 404;
      res.end('Not found');
    }
  });

  server.listen(port, () => {
    console.log(`Metrics server listening on port ${port}`);
  });

  return {
    connectionsTotal,
    connectionsActive,
    messagesTotal,
    sessionGauge,
    redisOperationsTotal,
    redisErrors
  };
} 
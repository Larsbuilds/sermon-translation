import { WebSocketServer, WebSocket as WS } from 'ws';
import { createServer } from 'http';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';
import Redis from 'ioredis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.ws if it exists
const envPath = resolve(__dirname, '../../.env.ws');
if (existsSync(envPath)) {
  config({ path: envPath });
  console.log('Loaded environment variables from .env.ws');
} else {
  console.log('No .env.ws file found, using default environment variables');
  // Set default values for required environment variables
  process.env.WS_PORT = process.env.WS_PORT || '3001';
  process.env.WS_HOST = process.env.WS_HOST || '0.0.0.0';
}

// Initialize Redis client
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
redis.on('connect', () => {
  console.log('Connected to Redis');
});
redis.on('error', (error: Error) => {
  console.error('Redis connection error:', error);
});

const wss = new WebSocketServer({ noServer: true });

// Store active connections
const connections = new Map<string, Set<WS>>();

// Redis key prefixes
const SESSION_PREFIX = 'ws:session:';
const CONNECTION_PREFIX = 'ws:connection:';

wss.on('connection', async (ws: WS, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId');
  const clientIp = req.socket.remoteAddress;

  console.log(`New connection attempt from ${clientIp}`);
  console.log(`Request URL: ${req.url}`);

  if (!sessionId) {
    console.log('Connection rejected: No session ID provided');
    ws.close(1008, 'Session ID is required');
    return;
  }

  try {
    // Store session in Redis
    await redis.set(`${SESSION_PREFIX}${sessionId}`, JSON.stringify({
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      clientIp
    }));

    // Add to connections
    if (!connections.has(sessionId)) {
      connections.set(sessionId, new Set());
      console.log(`Created new session: ${sessionId}`);
    }
    connections.get(sessionId)!.add(ws);

    // Store connection info in Redis
    const connectionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await redis.set(`${CONNECTION_PREFIX}${connectionId}`, JSON.stringify({
      sessionId,
      clientIp,
      connectedAt: new Date().toISOString()
    }));

    console.log(`Client connected to session ${sessionId}`);
    console.log(`Active sessions: ${connections.size}`);
    console.log(`Active connections in session ${sessionId}: ${connections.get(sessionId)!.size}`);

    ws.on('message', async (data: Buffer) => {
      try {
        const parsedData = JSON.parse(data.toString());
        console.log(`Received message in session ${sessionId}:`, {
          type: parsedData.type,
          dataSize: data.length
        });
        
        // Update last active timestamp in Redis
        await redis.set(`${SESSION_PREFIX}${sessionId}`, JSON.stringify({
          createdAt: new Date().toISOString(),
          lastActive: new Date().toISOString(),
          clientIp
        }));
        
        // Broadcast to all other clients in the same session
        const sessionConnections = connections.get(sessionId);
        if (sessionConnections) {
          sessionConnections.forEach((client) => {
            if (client !== ws && client.readyState === WS.OPEN) {
              client.send(JSON.stringify(parsedData));
              console.log(`Broadcasted message to client in session ${sessionId}`);
            }
          });
        }
      } catch (error) {
        console.error('Error handling message:', error);
      }
    });

    ws.on('close', async () => {
      // Remove from connections
      const sessionConnections = connections.get(sessionId);
      if (sessionConnections) {
        sessionConnections.delete(ws);
        if (sessionConnections.size === 0) {
          connections.delete(sessionId);
          console.log(`Session ${sessionId} closed - no more connections`);
        }
      }
      console.log(`Client disconnected from session ${sessionId}`);
      console.log(`Remaining active sessions: ${connections.size}`);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error in session ${sessionId}:`, error);
    });
  } catch (error) {
    console.error('Error handling connection:', error);
    ws.close(1011, 'Internal server error');
  }
});

const PORT = parseInt(process.env.WS_PORT || '3001', 10);
const HOST = process.env.WS_HOST || '0.0.0.0';

const server = createServer();

// Add healthcheck endpoint and handle all HTTP requests
server.on('request', (req, res) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`Received HTTP request: ${req.method} ${req.url} from ${clientIp}`);
  
  // Add CORS headers to all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS requests for CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/') {
    console.log(`Healthcheck request received from ${clientIp}`);
    try {
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        connections: connections.size,
        host: HOST,
        port: PORT,
        clientIp: clientIp,
        redis: redis.status === 'ready' ? 'connected' : 'disconnected'
      };
      
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      });
      res.end(JSON.stringify(healthStatus));
      console.log('Healthcheck response sent successfully:', healthStatus);
    } catch (error) {
      console.error('Error sending healthcheck response:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
    return;
  }

  // Handle 404 for all other routes
  console.log(`404 Not Found: ${req.url} from ${clientIp}`);
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    error: 'Not Found',
    path: req.url
  }));
});

// Handle server errors
server.on('error', (error: NodeJS.ErrnoException) => {
  console.error('Server error:', error);
  // Attempt to restart the server if it fails
  if (error.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is already in use, trying to close existing connections...`);
    server.close(() => {
      console.log('Server closed, attempting to restart...');
      server.listen(PORT, HOST, () => {
        console.log(`Server restarted successfully on ${HOST}:${PORT}`);
      });
    });
  }
});

server.on('upgrade', (request, socket, head) => {
  console.log('Received upgrade request');
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// Handle graceful shutdown
const shutdown = () => {
  console.log('Received shutdown signal, closing server...');
  
  // Close all WebSocket connections
  connections.forEach((sessionConnections, sessionId) => {
    console.log(`Closing session ${sessionId}`);
    sessionConnections.forEach((ws) => {
      if (ws.readyState === WS.OPEN) {
        ws.close(1000, 'Server shutting down');
      }
    });
  });
  
  // Close the HTTP server
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
};

// Handle various termination signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGUSR2', shutdown);

server.listen(PORT, HOST, () => {
  console.log(`WebSocket server is running on ${HOST}:${PORT}`);
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('WS_HOST:', process.env.WS_HOST);
  console.log('WS_PORT:', process.env.WS_PORT);
  console.log('Healthcheck available at http://' + HOST + ':' + PORT + '/');
  console.log('Server is ready to accept connections');
  
  // Test the healthcheck endpoint locally
  const testReq = {
    method: 'GET',
    url: '/',
    headers: { host: `${HOST}:${PORT}` },
    socket: { remoteAddress: '127.0.0.1' }
  };
  const testRes = {
    writeHead: (status: number, headers: any) => {
      console.log(`Local healthcheck test response status: ${status}`);
      console.log('Response headers:', headers);
    },
    end: (data: string) => {
      console.log('Local healthcheck test response data:', data);
    }
  };
  server.emit('request', testReq, testRes);
}); 
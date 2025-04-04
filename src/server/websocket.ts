import { WebSocketServer, WebSocket as WS } from 'ws';
import { Server as HttpServer, IncomingMessage, ServerResponse, createServer } from 'http';
import { config } from 'dotenv';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';
import Redis from 'ioredis';
import { env } from './env';
import rateLimit from 'express-rate-limit';

// Load environment variables from .env.ws if it exists
const envPath = resolve(__dirname, '../../.env.ws');
if (existsSync(envPath)) {
  config({ path: envPath });
  console.log('Loaded environment variables from .env.ws');
} else {
  console.log('No .env.ws file found, using default environment variables');
  // Set default values for required environment variables
  process.env.WS_PORT = process.env.WS_PORT || '3002';
  process.env.WS_HOST = process.env.WS_HOST || '0.0.0.0';
}

// Initialize Redis client with retry strategy
let redisClient: Redis | null = null;

export const getRedis = () => {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      password: env.REDIS_PASSWORD,
      tls: env.REDIS_TLS ? {} : undefined,
      maxRetriesPerRequest: 1,
      retryStrategy(times: number) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    redisClient.on('connect', () => {
      console.log('Connected to Redis');
    });

    redisClient.on('error', (error) => {
      console.error('Redis error:', error);
    });

    redisClient.on('ready', () => {
      console.log('Redis is ready');
    });
  }
  return redisClient;
};

// Export Redis client for testing
export const redis = getRedis();

// Session cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null;

// Start cleanup interval
const startCleanupInterval = () => {
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [sessionId, sessionConnections] of connections) {
      for (const [deviceId, ws] of sessionConnections) {
        if (ws.lastActivity && now - ws.lastActivity > 30000) {
          ws.close();
          sessionConnections.delete(deviceId);
        }
      }
      if (sessionConnections.size === 0) {
        connections.delete(sessionId);
      }
    }
  }, 10000);

  // Prevent the interval from keeping the process alive
  cleanupInterval.unref();
};

// Stop cleanup interval
const stopCleanupInterval = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
};

// Rate limiting setup
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

const wss = new WebSocketServer({ noServer: true });

// Extend WebSocket type
interface ExtendedWebSocket extends WS {
  sessionId?: string;
  deviceId?: string;
  isMain?: boolean;
  lastActivity?: number;
}

// Store active connections
const connections = new Map<string, Map<string, ExtendedWebSocket>>();

// Redis key prefixes
const SESSION_PREFIX = 'ws:session:';
const CONNECTION_PREFIX = 'ws:connection:';

// WebRTC Types for Node.js environment
interface RTCSessionDescriptionInit {
  type: 'offer' | 'answer' | 'pranswer' | 'rollback';
  sdp: string;
}

interface RTCIceCandidateInit {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

interface WebRTCMessage {
  type: 'offer' | 'answer' | 'ice-candidate';
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

wss.on('connection', async (ws: ExtendedWebSocket, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId');
  const deviceId = url.searchParams.get('deviceId');
  const isMain = url.searchParams.get('isMain') === 'true';
  const clientIp = req.socket.remoteAddress;

  console.log('New WebSocket connection:', {
    sessionId,
    deviceId,
    isMain,
    clientIp,
    path: url.pathname
  });

  if (!sessionId || !deviceId) {
    console.error('Missing required parameters:', { sessionId, deviceId });
    ws.close(4000, 'Missing required parameters');
    return;
  }

  // Check max connections per session
  const sessionConnections = connections.get(sessionId);
  if (sessionConnections && sessionConnections.size >= env.MAX_CONNECTIONS_PER_SESSION) {
    ws.close(4001, 'Maximum connections reached for session');
    return;
  }

  // Add connection to session
  if (!connections.has(sessionId)) {
    connections.set(sessionId, new Map());
  }
  connections.get(sessionId)?.set(deviceId, ws);

  // Store connection info
  ws.sessionId = sessionId;
  ws.deviceId = deviceId;
  ws.isMain = isMain;
  ws.lastActivity = Date.now();

  // Store session in Redis
  try {
    await redis.sadd('sessions', sessionId);
    await redis.set(`ws:session:${sessionId}`, JSON.stringify({
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      clientIp,
      isMain
    }), 'EX', env.SESSION_TTL);
  } catch (error) {
    console.error('Error storing session in Redis:', error);
  }

  // Handle messages
  ws.on('message', async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      ws.lastActivity = Date.now();

      if (env.ENABLE_REQUEST_LOGGING) {
        console.log(`Received message in session ${sessionId} from device ${deviceId}:`, {
          type: message.type,
          dataSize: data.length
        });
      }

      // Update session TTL in Redis
      try {
        await redis.expire(`ws:session:${sessionId}`, env.SESSION_TTL);
      } catch (error) {
        console.error('Error updating Redis TTL:', error);
      }

      // Broadcast message to other clients in session
      const sessionConnections = connections.get(sessionId);
      if (sessionConnections) {
        for (const [targetId, client] of Array.from(sessionConnections.entries())) {
          if (targetId !== deviceId && client.readyState === WS.OPEN) {
            try {
              client.send(JSON.stringify({
                ...message,
                from: deviceId
              }));
              if (env.ENABLE_REQUEST_LOGGING) {
                console.log(`Broadcasted ${message.type} to device ${targetId}`);
              }
            } catch (error) {
              console.error('Error sending message to client:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });

  // Handle connection close
  ws.on('close', async () => {
    console.log(`Connection closed for device ${deviceId} in session ${sessionId}`);
    const sessionConnections = connections.get(sessionId);
    if (sessionConnections) {
      sessionConnections.delete(deviceId);
      if (sessionConnections.size === 0) {
        connections.delete(sessionId);
        // Remove session from Redis if no connections remain
        try {
          await redis.del(`ws:session:${sessionId}`);
          await redis.srem('sessions', sessionId);
        } catch (error) {
          console.error('Error removing session from Redis:', error);
        }
      }
    }
  });
});

let server: HttpServer | null = null;

export function startServer(httpServer: HttpServer = createServer()) {
  server = httpServer;
  
  // Start cleanup interval
  startCleanupInterval();
  
  // Handle WebSocket upgrade requests
  httpServer.on('upgrade', (req: IncomingMessage, socket, head) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);

    // Health check endpoint
    if (url.pathname === '/health') {
      const response = `HTTP/1.1 200 OK\r\n\r\n${JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        connections: Array.from(connections.keys()).length
      })}`;
      socket.write(response);
      socket.destroy();
      return;
    }

    // WebSocket endpoints
    if (url.pathname !== '/webrtc' && url.pathname !== '/ws') {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    // CORS check
    const origin = req.headers.origin;
    if (!origin || !env.ALLOWED_ORIGINS.split(',').includes(origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    // Rate limiting
    if (env.NODE_ENV === 'production') {
      try {
        rateLimiter(req as any, {
          end: () => {
            socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
            socket.destroy();
          }
        } as any as ServerResponse, () => {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
          });
        });
      } catch (error) {
        console.error('Rate limiting error:', error);
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
      }
    } else {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  });

  // Handle HTTP requests
  httpServer.on('request', (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    
    // Handle health check
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    // Handle all other requests
    res.writeHead(404);
    res.end();
  });

  // Start listening
  const port = parseInt(process.env.PORT || '3002', 10);
  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
  httpServer.listen(port, host, () => {
    console.log(`WebSocket server is running on ${host}:${port}`);
    console.log(`WebRTC endpoint: ws://${host}:${port}/webrtc`);
    console.log(`WebSocket endpoint: ws://${host}:${port}/ws`);
    console.log('Environment:', process.env.NODE_ENV || 'development');
  });

  return wss;
}

// Cleanup function for tests
export const cleanup = async () => {
  try {
    // Stop cleanup interval
    stopCleanupInterval();

    // Close all WebSocket connections
    for (const [sessionId, sessionConnections] of connections) {
      for (const [deviceId, ws] of sessionConnections) {
        ws.close();
      }
      sessionConnections.clear();
    }
    connections.clear();

    // Close Redis connection if it exists
    if (redisClient) {
      await redisClient.quit();
      redisClient = null;
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
};

// Handle process termination
const shutdown = async () => {
  console.log('Shutting down WebSocket server...');
  await cleanup();
  process.exit(0);
};

// Handle various termination signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGUSR2', shutdown);
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  shutdown();
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown();
});

// Start server if this is the main module
if (require.main === module) {
  const server = createServer();
  startServer(server);
  startCleanupInterval();
  
  server.listen({ port: process.env.PORT || 3002, host: process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost' }, () => {
    console.log(`WebSocket server is running on ${process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'}:${process.env.PORT || 3002}`);
    console.log(`WebRTC endpoint: ws://${process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'}:${process.env.PORT || 3002}/webrtc`);
    console.log(`WebSocket endpoint: ws://${process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'}:${process.env.PORT || 3002}/ws`);
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('Server is ready to accept connections');
  });
} 
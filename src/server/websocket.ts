import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server as HttpServer, IncomingMessage, ServerResponse } from 'http';
import { config } from 'dotenv';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import Redis, { Redis as RedisClient } from 'ioredis';
import rateLimit from 'express-rate-limit';
import { parse } from 'url';
import { Socket } from 'net';
import { env } from './env.ts';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Store server instances for cleanup
let server: HttpServer | null = null;
let healthServer: HttpServer | null = null;
let backupHealthServer: HttpServer | null = null;

// Store active connections
const connections = new Map<string, Map<string, ExtendedWebSocket>>();

// Define WebSocket close codes
const CLOSE_CODES = {
  NORMAL: 1000,
  GOING_AWAY: 1001,
  PROTOCOL_ERROR: 1002,
  UNSUPPORTED_DATA: 1003,
  NO_STATUS_RECEIVED: 1005,
  ABNORMAL_CLOSURE: 1006,
  INVALID_FRAME_PAYLOAD_DATA: 1007,
  POLICY_VIOLATION: 1008,
  MESSAGE_TOO_BIG: 1009,
  MANDATORY_EXTENSION: 1010,
  INTERNAL_ERROR: 1011,
  SERVICE_RESTART: 1012,
  TRY_AGAIN_LATER: 1013,
  BAD_GATEWAY: 1014,
  TLS_HANDSHAKE: 1015,
} as const;

// Extend WebSocket type
interface ExtendedWebSocket extends WebSocket {
  sessionId?: string;
  deviceId?: string;
  lastActivity?: number;
}

// Broadcast message to all clients in a session except the sender
const broadcastToSession = (sessionId: string, senderDeviceId: string, message: any) => {
  const sessionConnections = connections.get(sessionId);
  if (!sessionConnections) {
    console.warn(`[WS] Broadcast failed - Session ${sessionId} not found`);
    return;
  }

  console.log(`[WS] Broadcasting message in session ${sessionId}`, {
    sender: senderDeviceId,
    recipients: sessionConnections.size - 1,
    messageType: message.type,
    timestamp: new Date().toISOString()
  });

  for (const [deviceId, ws] of sessionConnections) {
    if (deviceId !== senderDeviceId && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
        console.log(`[WS] Message sent to ${deviceId} in session ${sessionId}`);
      } catch (error) {
        console.error(`[WS] Failed to send message to ${deviceId}:`, error);
      }
    }
  }
};

// Create a dedicated standalone health server
export const startStandaloneHealthServer = () => {
  // Only start health server in production
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  try {
    healthServer = createServer((req: IncomingMessage, res: ServerResponse) => {
      console.log(`[Standalone Health Server] Request received: ${req.url}`);
      
      if (req.url === '/health' || req.url === '/') {
        const health = {
          status: 'ok',
          environment: process.env.NODE_ENV || 'development',
          redis: 'connected',
        };
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(health));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    
    healthServer.on('error', (err: NodeJS.ErrnoException) => {
      console.error('Failed to start standalone health server:', err);
      
      // Try backup port
      backupHealthServer = createServer((req: IncomingMessage, res: ServerResponse) => {
        if (req.url === '/health' || req.url === '/') {
          const health = {
            status: 'ok',
            environment: process.env.NODE_ENV || 'development',
            redis: 'connected',
          };
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(health));
        } else {
          res.writeHead(404);
          res.end();
        }
      });
      
      backupHealthServer.listen(8081, () => {
        console.log('Backup health server listening on port 8081');
      });
    });
    
    healthServer.listen(8080, () => {
      console.log('Health server listening on port 8080');
    });
  } catch (err: unknown) {
    console.error('Error creating standalone health server:', err);
  }
};

// Start the WebSocket server
const startServer = () => {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    console.log(`[HTTP] ${req.method} request to ${req.url}`);
    if (req.url === '/health') {
      const health = {
        status: 'degraded',
        environment: process.env.NODE_ENV || 'development',
        redis: 'reconnecting',
      };
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(health));
      console.log('[HTTP] Health check response sent');
    } else {
      res.writeHead(404);
      res.end();
      console.log('[HTTP] 404 response sent');
    }
  });

  const wss = new WebSocketServer({ noServer: true });

  // Handle upgrade requests
  server.on('upgrade', (request: IncomingMessage, socket: Socket, head: Buffer) => {
    const { pathname, query } = parse(request.url || '', true);
    const origin = request.headers.origin;
    console.log(`[WS] Upgrade request from ${origin} for path ${pathname}`);

    // Check CORS
    if (origin && !process.env.ALLOWED_ORIGINS?.split(',').includes(origin)) {
      console.warn(`[WS] CORS check failed for origin: ${origin}`);
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    // Only handle /webrtc path
    if (pathname?.split('?')[0] !== '/webrtc') {
      console.warn(`[WS] Invalid path requested: ${pathname}`);
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    // Check required parameters
    const params = query as { sessionId?: string; deviceId?: string; isMain?: string };
    const sessionId = params.sessionId;
    const deviceId = params.deviceId;
    const isMain = params.isMain === 'true';

    console.log(`[WS] Connection attempt - Session: ${sessionId}, Device: ${deviceId}, Main: ${isMain}`);

    if (!sessionId || !deviceId) {
      console.warn('[WS] Missing required parameters');
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    // Check connection limit
    const sessionConnections = connections.get(sessionId) || new Map<string, ExtendedWebSocket>();
    if (sessionConnections.size >= (Number(process.env.MAX_CONNECTIONS_PER_SESSION) || 3)) {
      console.warn(`[WS] Connection limit reached for session ${sessionId}`);
      socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
      socket.destroy();
      return;
    }

    // Accept the upgrade
    wss.handleUpgrade(request, socket, head, (ws: ExtendedWebSocket) => {
      console.log(`[WS] Connection established - Session: ${sessionId}, Device: ${deviceId}`);
      ws.sessionId = sessionId;
      ws.deviceId = deviceId;
      ws.lastActivity = Date.now();
      
      // Initialize session connections if not exists
      if (!connections.has(sessionId)) {
        connections.set(sessionId, new Map());
        console.log(`[WS] New session created: ${sessionId}`);
      }
      const sessionConnections = connections.get(sessionId)!;
      sessionConnections.set(deviceId, ws);
      console.log(`[WS] Active connections in session ${sessionId}: ${sessionConnections.size}`);

      // Handle messages
      ws.on('message', (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          ws.lastActivity = Date.now();
          console.log(`[WS] Message received from ${deviceId} in session ${sessionId}:`, {
            type: data.type,
            size: message.length,
            timestamp: new Date().toISOString()
          });
          broadcastToSession(sessionId, deviceId, data);
        } catch (error) {
          console.error(`[WS] Error handling message from ${deviceId}:`, error);
          ws.close(CLOSE_CODES.INVALID_FRAME_PAYLOAD_DATA);
        }
      });

      // Handle close
      ws.on('close', (code: number, reason: string) => {
        console.log(`[WS] Connection closed - Session: ${sessionId}, Device: ${deviceId}`, {
          code,
          reason: reason.toString(),
          timestamp: new Date().toISOString()
        });
        const sessionConnections = connections.get(sessionId);
        if (sessionConnections) {
          sessionConnections.delete(deviceId);
          console.log(`[WS] Device ${deviceId} removed from session ${sessionId}`);
          if (sessionConnections.size === 0) {
            connections.delete(sessionId);
            console.log(`[WS] Session ${sessionId} deleted (no active connections)`);
          }
        }
      });

      // Handle errors
      ws.on('error', (error: Error) => {
        console.error(`[WS] WebSocket error for ${deviceId} in session ${sessionId}:`, {
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
        ws.close(CLOSE_CODES.INTERNAL_ERROR);
      });

      wss.emit('connection', ws);
    });
  });

  return server;
};

// Cleanup function to close all connections and servers
const cleanup = async () => {
  // Close all WebSocket connections
  for (const [sessionId, sessionConnections] of connections) {
    for (const [deviceId, ws] of sessionConnections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(CLOSE_CODES.GOING_AWAY, 'Server shutting down');
      }
    }
    connections.delete(sessionId);
  }

  // Close Redis client if it exists
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (error) {
      console.error('Error closing Redis client:', error);
    }
  }

  // Helper function to close a server
  const closeServer = (server: HttpServer | null) => {
    if (server) {
      return new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
        // Force close any remaining connections after 5 seconds
        setTimeout(() => {
          server.closeAllConnections();
          resolve();
        }, 5000);
      });
    }
    return Promise.resolve();
  };

  // Close all servers
  await Promise.all([
    closeServer(server),
    closeServer(healthServer),
    closeServer(backupHealthServer),
  ]);

  // Wait for all operations to complete
  await new Promise((resolve) => setTimeout(resolve, 1000));
};

// Export the server and cleanup function for testing
export { startServer, cleanup };

// Start the server if this is the main module
if (import.meta.url === import.meta.url) {
  const port = env.WS_PORT || 3002;
  const host = env.WS_HOST || 'localhost';

  const server = startServer();
  server.listen(port, host, () => {
    console.log(`WebSocket server is running on ws://${host}:${port}`);
  });

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received. Cleaning up...');
    await cleanup();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT signal received. Cleaning up...');
    await cleanup();
    process.exit(0);
  });
}

// Initialize Redis client with retry strategy
let redisClient: RedisClient | null = null;
let redisStatus = 'not_initialized';

export const getRedis = (): RedisClient | null => {
  if (!redisClient) {
    console.log('===== REDIS CONNECTION DETAILS =====');
    console.log('Initializing Redis connection to:', env.REDIS_URL);
    console.log('Redis TLS enabled:', env.REDIS_TLS);
    console.log('Redis password set:', env.REDIS_PASSWORD ? 'Yes' : 'No');
    
    try {
      // Check if we're using the Railway internal network
      const isRailwayInternal = env.REDIS_URL.includes('.railway.internal');
      
      const redisOptions = {
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
        retryStrategy(times: number) {
          const delay = Math.min(times * 100, 3000);
          console.log(`Redis connection retry ${times}, delaying ${delay}ms`);
          return delay;
        }
      };
      
      if (isRailwayInternal) {
        console.log('Using Railway internal networking for Redis connection');
        // When using Railway internal DNS, use the URL directly
        redisClient = new Redis.default(env.REDIS_URL, redisOptions);
      } else {
        // For local development or when using explicit host/port
        console.log('Using direct Redis connection (localhost or custom)');
        // Parse Redis URL to get host and port
        const redisUrl = new URL(env.REDIS_URL);
        
        // Force localhost connection with explicit port instead of using URI
        // This avoids potential DNS resolution issues inside the container
        redisClient = new Redis.default({
          host: redisUrl.hostname,
          port: parseInt(redisUrl.port || '6379'),
          password: env.REDIS_PASSWORD,
          tls: env.REDIS_TLS ? {} : undefined,
          ...redisOptions
        });
      }

      console.log('Redis client created with configuration:', {
        url: env.REDIS_URL,
        tls: env.REDIS_TLS,
        password: env.REDIS_PASSWORD ? 'set' : 'not set'
      });

      if (redisClient) {
        redisClient.on('connect', () => {
          console.log('Redis client connected');
          redisStatus = 'connected';
        });

        redisClient.on('ready', () => {
          console.log('Redis client ready');
          redisStatus = 'ready';
        });

        redisClient.on('error', (error: Error) => {
          console.error('Redis client error:', error);
          redisStatus = 'error';
        });

        redisClient.on('close', () => {
          console.log('Redis client closed');
          redisStatus = 'closed';
        });

        redisClient.on('reconnecting', () => {
          console.log('Redis client reconnecting...');
          redisStatus = 'reconnecting';
        });
      }
    } catch (error) {
      console.error('Error creating Redis client:', error);
      redisStatus = 'error';
    }
  }
  return redisClient;
};

// Export Redis client for testing
export const redis = getRedis();

// Safe Redis operations with fallbacks
export const safeRedisOp = async <T>(operation: () => Promise<T>, fallback: T): Promise<T> => {
  if (!redisClient || redisStatus === 'error' || redisStatus === 'closed') {
    console.log('Redis not available, using fallback');
    return fallback;
  }

  try {
    return await operation();
  } catch (error) {
    console.error('Redis operation failed:', error);
    return fallback;
  }
};

// Session cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null;

// Start cleanup interval
const startCleanupInterval = () => {
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [sessionId, sessionConnections] of connections) {
      for (const [deviceId, ws] of sessionConnections) {
        if (ws.lastActivity && now - ws.lastActivity > 30000) {
          ws.terminate();
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

// Redis key prefixes
const SESSION_PREFIX = 'ws:session:';
const CONNECTION_PREFIX = 'ws:connection:';

// Error handler for server startup
const handleServerError = (err: NodeJS.ErrnoException & { port?: number }) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${err.port || 'unknown'} is already in use`);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  } else {
    console.error('Server error:', err);
  }
};
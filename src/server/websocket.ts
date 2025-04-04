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
  // Don't set WS_PORT if it's already set by Railway as PORT
  if (!process.env.PORT) {
    process.env.WS_PORT = process.env.WS_PORT || '8080';
  }
  process.env.WS_HOST = process.env.WS_HOST || '0.0.0.0';
}

// Initialize Redis client with retry strategy
let redisClient: Redis | null = null;
let redisStatus = 'not_initialized';

export const getRedis = () => {
  if (!redisClient) {
    console.log('===== REDIS CONNECTION DETAILS =====');
    console.log('Initializing Redis connection to:', env.REDIS_URL);
    console.log('Redis TLS enabled:', env.REDIS_TLS);
    console.log('Redis password set:', env.REDIS_PASSWORD ? 'Yes' : 'No');
    
    try {
      // Check if we're using the Railway internal network
      const isRailwayInternal = env.REDIS_URL.includes('.railway.internal');
      
      if (isRailwayInternal) {
        console.log('Using Railway internal networking for Redis connection');
        // When using Railway internal DNS, use the URL directly
        redisClient = new Redis(env.REDIS_URL, {
          maxRetriesPerRequest: 3,
          connectTimeout: 10000,
          retryStrategy(times: number) {
            const delay = Math.min(times * 100, 3000);
            console.log(`Redis connection retry ${times}, delaying ${delay}ms`);
            return delay;
          }
        });
      } else {
        // For local development or when using explicit host/port
        console.log('Using direct Redis connection (localhost or custom)');
        // Parse Redis URL to get host and port
        const redisUrl = new URL(env.REDIS_URL);
        
        // Force localhost connection with explicit port instead of using URI
        // This avoids potential DNS resolution issues inside the container
        redisClient = new Redis({
          host: redisUrl.hostname,
          port: parseInt(redisUrl.port || '6379'),
          password: env.REDIS_PASSWORD,
          tls: env.REDIS_TLS ? {} : undefined,
          maxRetriesPerRequest: 3,
          connectTimeout: 10000,
          retryStrategy(times: number) {
            const delay = Math.min(times * 100, 3000);
            console.log(`Redis connection retry ${times}, delaying ${delay}ms`);
            return delay;
          }
        });
      }

      console.log('Redis client created with configuration:', {
        url: env.REDIS_URL,
        tls: env.REDIS_TLS ? 'enabled' : 'disabled'
      });

      redisClient.on('connect', () => {
        console.log('===== REDIS CONNECTED =====');
        redisStatus = 'connected';
      });

      redisClient.on('error', (error) => {
        console.error('===== REDIS ERROR =====');
        console.error('Error details:', error);
        console.error('Redis URL:', env.REDIS_URL);
        console.error('Redis status was:', redisStatus);
        redisStatus = 'error';
      });

      redisClient.on('ready', () => {
        console.log('===== REDIS READY =====');
        redisStatus = 'ready';
        
        // Test Redis functionality
        if (redisClient) {
          redisClient.set('health_test', 'ok', 'EX', 60)
            .then(() => console.log('Successfully set test key in Redis'))
            .catch(err => console.error('Failed to set test key in Redis:', err));
            
          redisClient.get('health_test')
            .then(val => console.log('Test key value:', val))
            .catch(err => console.error('Failed to get test key from Redis:', err));
        }
      });

      redisClient.on('close', () => {
        console.log('===== REDIS CONNECTION CLOSED =====');
        redisStatus = 'closed';
      });

      redisClient.on('reconnecting', () => {
        console.log('===== REDIS RECONNECTING =====');
        redisStatus = 'reconnecting';
      });
    } catch (error) {
      console.error('===== REDIS INITIALIZATION FAILED =====');
      console.error('Error details:', error);
      console.error('Redis URL:', env.REDIS_URL);
      redisStatus = 'initialization_failed';
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
  await safeRedisOp(async () => {
    const client = getRedis();
    if (!client) return false;
    
    await client.sadd('sessions', sessionId);
    await client.set(`ws:session:${sessionId}`, JSON.stringify({
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      clientIp,
      isMain
    }), 'EX', env.SESSION_TTL);
    return true;
  }, false);

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
      await safeRedisOp(async () => {
        const client = getRedis();
        if (!client) return false;
        
        await client.expire(`ws:session:${sessionId}`, env.SESSION_TTL);
        return true;
      }, false);

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
        await safeRedisOp(async () => {
          const client = getRedis();
          if (!client) return false;
          
          await client.del(`ws:session:${sessionId}`);
          await client.srem('sessions', sessionId);
          return true;
        }, false);
      }
    }
  });
});

// Initialize HTTP server
let httpServer: HttpServer;

export const startServer = (server?: HttpServer) => {
  httpServer = server || createServer();
  
  const host = env.WS_HOST || '0.0.0.0'; // Default to 0.0.0.0 for container deployments
  const port = env.WS_PORT || 8080; // WS_PORT is now a number, no need to parse

  // Start cleanup interval
  startCleanupInterval();
  
  // Handle WebSocket upgrade requests
  httpServer.on('upgrade', (req: IncomingMessage, socket, head) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);

    // Health check endpoint
    if (url.pathname === '/health') {
      console.log('Health check requested via upgrade from:', req.socket.remoteAddress);
      const health = {
        status: redisStatus === 'ready' || redisStatus === 'connected' ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        connections: Array.from(connections.keys()).length,
        redis: redisStatus,
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 'not set',
        ws_port: env.WS_PORT || 'not set',
        host: req.headers.host,
        pid: process.pid,
        memory: process.memoryUsage()
      };
      console.log('Health check response via upgrade:', JSON.stringify(health));
      const response = `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(health)}`;
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
      console.log('Health check requested from:', req.socket.remoteAddress);
      
      // Always respond to health checks even if Redis is not connected
      const health = {
        status: redisStatus === 'ready' || redisStatus === 'connected' ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        connections: Array.from(connections.keys()).length,
        redis: redisStatus,
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 'not set',
        ws_port: env.WS_PORT || 'not set',
        host: req.headers.host,
        pid: process.pid,
        memory: process.memoryUsage()
      };
      console.log('Health check response:', JSON.stringify(health));
      
      // Always return 200 for health checks to prevent Railway from restarting
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(health));
      return;
    }

    // Handle all other requests
    res.writeHead(404);
    res.end();
  });

  return wss;
};

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
  console.log('===== STARTING MAIN WEBSOCKET SERVER MODULE =====');
  
  // Create the HTTP server
  const server = createServer();
  
  // Use Railway's PORT first, then WS_PORT if set, then default to 8080
  const port = parseInt(process.env.PORT || '') || env.WS_PORT || 8080;
  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
  
  console.log('Server configuration:');
  console.log(`PORT env: ${process.env.PORT || 'not set'}`);
  console.log(`WS_PORT env: ${env.WS_PORT || 'not set'}`);
  console.log(`Using port: ${port}`);
  console.log(`Using host: ${host}`);

  // Create a separate simple HTTP server just for health checks
  console.log('Starting dedicated health check server...');
  
  // Use a very simple HTTP server for health checks that has no dependencies
  const healthServer = require('http').createServer((req: IncomingMessage, res: ServerResponse) => {
    console.log(`[Health Server] Request received: ${req.url}`);
    
    if (req.url === '/health' || req.url === '/') {
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        server: 'health-dedicated',
        uptime: process.uptime()
      };
      
      console.log('[Health Server] Sending 200 OK response');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(health));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  // Start health server immediately and bind to all interfaces (0.0.0.0)
  try {
    const healthPort = port + 1;
    console.log(`Starting health server on 0.0.0.0:${healthPort}...`);
    
    healthServer.listen(healthPort, '0.0.0.0', () => {
      console.log(`Dedicated health check server running on 0.0.0.0:${healthPort}`);
    });
    
    healthServer.on('error', (err: NodeJS.ErrnoException) => {
      console.error('Failed to start health server:', err);
      console.log('Starting a backup health server...');
      
      // Try one more time on a different port
      try {
        healthServer.listen(healthPort + 1, '0.0.0.0', () => {
          console.log(`Backup health check server running on 0.0.0.0:${healthPort + 1}`);
        });
      } catch (backupErr) {
        console.error('Failed to start backup health server:', backupErr);
      }
    });
  } catch (err) {
    console.error('Error starting health server:', err);
  }
  
  // Test Redis connection before starting WebSocket server
  const checkRedisAndStart = async () => {
    console.log('Testing Redis connection before starting WebSocket server...');
    try {
      const client = getRedis();
      
      if (!client) {
        console.error('Redis client could not be created. Starting WebSocket server anyway...');
      } else {
        console.log('Redis client created successfully.');
        
        // Try a simple operation to verify Redis is working
        try {
          console.log('Testing Redis SET operation...');
          await client.set('startup_test', 'ok', 'EX', 60);
          console.log('Redis SET operation successful');
          
          console.log('Testing Redis GET operation...');
          const value = await client.get('startup_test');
          console.log('Redis GET operation successful, value:', value);
        } catch (redisOpError) {
          console.error('Error testing Redis operations:', redisOpError);
          console.log('Continuing with WebSocket server startup despite Redis operation errors');
        }
      }
      
      // Start WebSocket server regardless of Redis status
      console.log('Starting WebSocket server...');
      startServer(server);
      
      // Listen on configured port and host
      server.listen(port, host, () => {
        console.log(`WebSocket server is running on ${host}:${port}`);
        console.log(`WebRTC endpoint: ws://${host}:${port}/webrtc`);
        console.log(`WebSocket endpoint: ws://${host}:${port}/ws`);
        console.log(`Health endpoint: http://${host}:${port}/health`);
        console.log(`Dedicated health endpoint: http://${host}:${port + 1}/health`);
        console.log('Environment:', process.env.NODE_ENV || 'development');
        console.log('Server is ready to accept connections');
      }).on('error', (err: NodeJS.ErrnoException) => {
        console.error('Failed to start server:', err);
        if (err.code === 'EADDRINUSE') {
          console.error(`Port ${port} is already in use. Check for other services using this port.`);
        }
        process.exit(1);
      });
    } catch (error) {
      console.error('Error during Redis check:', error);
      
      // Start WebSocket server despite Redis errors
      console.log('Starting WebSocket server despite Redis errors...');
      startServer(server);
      
      // Listen on configured port and host
      server.listen(port, host, () => {
        console.log(`WebSocket server is running on ${host}:${port}`);
        console.log(`WebRTC endpoint: ws://${host}:${port}/webrtc`);
        console.log(`WebSocket endpoint: ws://${host}:${port}/ws`);
        console.log(`Health endpoint: http://${host}:${port}/health`);
        console.log(`Dedicated health endpoint: http://${host}:${port + 1}/health`);
        console.log('Environment:', process.env.NODE_ENV || 'development');
        console.log('Server is ready to accept connections');
      }).on('error', (err: NodeJS.ErrnoException) => {
        console.error('Failed to start server:', err);
        if (err.code === 'EADDRINUSE') {
          console.error(`Port ${port} is already in use. Check for other services using this port.`);
        }
        process.exit(1);
      });
    }
  };
  
  // Start the WebSocket server after checking Redis
  checkRedisAndStart();
} 
import { WebSocketServer, WebSocket as WS } from 'ws';
import { createServer, Server, IncomingMessage, ServerResponse } from 'http';
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
  process.env.WS_PORT = process.env.WS_PORT || '3002';
  process.env.WS_HOST = process.env.WS_HOST || '0.0.0.0';
}

// Initialize Redis client with retry strategy
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true
});

redis.on('connect', () => {
  console.log('Connected to Redis');
});

redis.on('error', (error: Error) => {
  console.error('Redis connection error:', error);
});

redis.on('ready', () => {
  console.log('Redis is ready');
});

const wss = new WebSocketServer({ noServer: true });

// Extend WebSocket type
interface ExtendedWebSocket extends WS {
  sessionId?: string;
  deviceId?: string;
  isMain?: boolean;
}

// Store active connections
const connections = new Map<string, Map<string, ExtendedWebSocket>>();

// Redis key prefixes
const SESSION_PREFIX = 'ws:session:';
const CONNECTION_PREFIX = 'ws:connection:';

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

  // Add connection to session
  if (!connections.has(sessionId)) {
    connections.set(sessionId, new Map());
  }
  connections.get(sessionId)?.set(deviceId, ws);

  // Store session info
  ws.sessionId = sessionId;
  ws.deviceId = deviceId;
  ws.isMain = isMain;

  // Handle messages
  ws.on('message', async (data: Buffer) => {
    try {
      const parsedData = JSON.parse(data.toString());
      console.log(`Received message in session ${sessionId} from device ${deviceId}:`, {
        type: parsedData.type,
        dataSize: data.length
      });
      
      // Update last active timestamp in Redis
      try {
        await redis.set(`${SESSION_PREFIX}${sessionId}`, JSON.stringify({
          createdAt: new Date().toISOString(),
          lastActive: new Date().toISOString(),
          clientIp
        }));
      } catch (redisError) {
        console.error('Error updating Redis:', redisError);
        // Continue processing the message even if Redis update fails
      }
      
      // Handle WebRTC signaling messages
      const sessionConnections = connections.get(sessionId);
      if (sessionConnections) {
        switch (parsedData.type) {
          case 'offer':
          case 'answer':
            // Broadcast to all other clients in the same session
            sessionConnections.forEach((client) => {
              if (client !== ws && client.readyState === WS.OPEN) {
                try {
                  client.send(JSON.stringify({
                    type: parsedData.type,
                    [parsedData.type]: parsedData[parsedData.type],
                    from: deviceId
                  }));
                  console.log(`Broadcasted ${parsedData.type} to device ${client.deviceId} in session ${sessionId}`);
                } catch (sendError) {
                  console.error('Error sending message to client:', sendError);
                }
              }
            });
            break;
          case 'ice-candidate': {
            const parsedData = JSON.parse(data.toString()) as WebRTCMessage;
            console.log(`Received message in session ${ws.sessionId} from device ${ws.deviceId}:`, { type: 'ice-candidate', dataSize: parsedData.candidate ? JSON.stringify(parsedData.candidate).length : 0 });
            // Ensure required fields are present
            const candidate = {
              ...parsedData.candidate,
              sdpMid: parsedData.candidate?.sdpMid || '0',
              sdpMLineIndex: parsedData.candidate?.sdpMLineIndex || 0
            };
            // Broadcast to other clients in the same session
            const currentDeviceId = (ws as ExtendedWebSocket).deviceId;
            if (currentDeviceId) {
              Array.from(sessionConnections.entries()).forEach(([clientId, client]) => {
                if (clientId !== currentDeviceId) {
                  try {
                    client.send(JSON.stringify({
                      type: 'ice-candidate',
                      candidate,
                      from: currentDeviceId
                    }));
                    console.log(`Broadcasted ice-candidate to device ${clientId} in session ${ws.sessionId}`);
                  } catch (sendError) {
                    console.error('Error sending ICE candidate to client:', sendError);
                  }
                }
              });
            }
            break;
          }
          default:
            console.error('Unknown message type:', parsedData.type);
        }
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });

  // Handle connection close
  ws.on('close', () => {
    console.log(`Connection closed for device ${deviceId} in session ${sessionId}`);
    const sessionConnections = connections.get(sessionId);
    if (sessionConnections) {
      sessionConnections.delete(deviceId);
      if (sessionConnections.size === 0) {
        connections.delete(sessionId);
      }
    }
  });
});

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3002;
const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

export const startServer = (httpServer: Server = createServer()) => {
  // Handle WebSocket upgrade requests
  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);

    if (url.pathname === '/webrtc' || url.pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
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

  return wss;
};

// Handle graceful shutdown
const shutdown = async () => {
  console.log('Received shutdown signal, closing server...');
  
  // Close all WebSocket connections
  const sessionIds = Array.from(connections.keys());
  for (const sessionId of sessionIds) {
    const sessionConnections = connections.get(sessionId);
    if (sessionConnections) {
      console.log(`Closing session ${sessionId}`);
      const connections = Array.from(sessionConnections.values());
      for (const ws of connections) {
        if (ws.readyState === WS.OPEN) {
          ws.close(1000, 'Server shutting down');
        }
      }
      // Clean up Redis session data
      try {
        await redis.del(`${SESSION_PREFIX}${sessionId}`);
        console.log(`Cleaned up Redis data for session ${sessionId}`);
      } catch (error) {
        console.error(`Error cleaning up Redis data for session ${sessionId}:`, error);
      }
    }
  }
  
  // Clean up Redis connection data
  try {
    const keys = await redis.keys(`${CONNECTION_PREFIX}*`);
    if (keys.length > 0) {
      await redis.del(keys);
      console.log(`Cleaned up ${keys.length} connection records from Redis`);
    }
  } catch (error) {
    console.error('Error cleaning up Redis connection data:', error);
  }
  
  // Close Redis connection
  try {
    await redis.quit();
    console.log('Redis connection closed');
  } catch (error) {
    console.error('Error closing Redis connection:', error);
  }
  
  // Close the HTTP server
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
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
if (import.meta.url === `file://${fileURLToPath(process.argv[1])}`) {
  const server = createServer();
  startServer(server);
  
  server.listen({ port, host }, () => {
    console.log(`WebSocket server is running on ${host}:${port}`);
    console.log(`WebRTC endpoint: ws://${host}:${port}/webrtc`);
    console.log(`WebSocket endpoint: ws://${host}:${port}/ws`);
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('Server is ready to accept connections');
  });
} 
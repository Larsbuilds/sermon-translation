import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { WebSocket } from 'ws';
import Redis from 'ioredis';
import { startServer } from '../../server/websocket';
import { createServer, Server } from 'http';

describe('WebSocket Server Integration', () => {
  let redis: Redis;
  let wss: ReturnType<typeof startServer>;
  let httpServer: Server;
  let port: number;

  beforeAll(async () => {
    // Start Redis
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
    });

    // Wait for Redis connection
    await new Promise<void>((resolve, reject) => {
      redis.on('connect', resolve);
      redis.on('error', reject);
    });

    await redis.flushall(); // Clear Redis database

    // Create HTTP server
    httpServer = createServer();
    wss = startServer(httpServer);

    // Start server on random port
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        port = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
  }, 30000); // Increase timeout to 30 seconds

  afterAll(async () => {
    // Cleanup
    await redis.quit();
    await new Promise<void>((resolve) => {
      wss.close(() => {
        httpServer.close(() => resolve());
      });
    });
  }, 10000);

  test('should connect to WebSocket server', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/webrtc?sessionId=test&deviceId=test&isMain=true`);
    
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        resolve();
      });
      ws.on('error', reject);
    });
  }, 10000);

  test('should handle missing parameters', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/webrtc`);
    
    await new Promise<void>((resolve) => {
      ws.on('close', (code) => {
        expect(code).toBe(4000); // Bad request
        resolve();
      });
    });
  }, 10000);

  test('should broadcast messages within session', async () => {
    const ws1 = new WebSocket(`ws://localhost:${port}/webrtc?sessionId=test&deviceId=device1&isMain=true`);
    const ws2 = new WebSocket(`ws://localhost:${port}/webrtc?sessionId=test&deviceId=device2&isMain=false`);
    
    await new Promise<void>((resolve) => {
      let connected = 0;
      const onOpen = () => {
        connected++;
        if (connected === 2) {
          ws1.send(JSON.stringify({ type: 'test', data: 'hello' }));
        }
      };

      ws2.on('message', (data) => {
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('test');
        expect(message.data).toBe('hello');
        ws1.close();
        ws2.close();
        resolve();
      });

      ws1.on('open', onOpen);
      ws2.on('open', onOpen);
    });
  }, 10000);

  test('should store session data in Redis', async () => {
    const sessionId = 'test-session';
    const ws = new WebSocket(`ws://localhost:${port}/webrtc?sessionId=${sessionId}&deviceId=test&isMain=true`);
    
    await new Promise<void>((resolve) => {
      ws.on('open', async () => {
        const sessions = await redis.smembers('sessions');
        expect(sessions).toContain(sessionId);
        ws.close();
        resolve();
      });
    });
  }, 10000);

  test('should handle reconnection', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/webrtc?sessionId=test&deviceId=test&isMain=true`);
    
    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        ws.close();
        const ws2 = new WebSocket(`ws://localhost:${port}/webrtc?sessionId=test&deviceId=test&isMain=true`);
        ws2.on('open', () => {
          expect(ws2.readyState).toBe(WebSocket.OPEN);
          ws2.close();
          resolve();
        });
      });
    });
  }, 10000);
}); 
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
      const timeout = setTimeout(() => {
        reject(new Error('Redis connection timeout'));
      }, 5000);

      redis.on('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
      redis.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
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
    const cleanup = async () => {
      try {
        await redis.quit();
        await new Promise<void>((resolve) => {
          wss.close(() => {
            httpServer.close(() => resolve());
          });
        });
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    };

    await cleanup();
  }, 30000); // Increase timeout to 30 seconds

  test('should connect to WebSocket server', (done) => {
    const ws = new WebSocket(`ws://localhost:${port}/webrtc?sessionId=test&deviceId=test&isMain=true`);
    
    ws.on('open', () => {
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
      done();
    });

    ws.on('error', done);
  }, 10000);

  test('should handle missing parameters', (done) => {
    const ws = new WebSocket(`ws://localhost:${port}/webrtc`);
    
    ws.on('close', (code) => {
      expect(code).toBe(4000); // Bad request
      done();
    });
  }, 10000);

  test('should broadcast messages within session', (done) => {
    let ws1: WebSocket | null = null;
    let ws2: WebSocket | null = null;
    
    const cleanup = () => {
      if (ws1) ws1.close();
      if (ws2) ws2.close();
    };

    try {
      ws1 = new WebSocket(`ws://localhost:${port}/webrtc?sessionId=test&deviceId=device1&isMain=true`);
      ws2 = new WebSocket(`ws://localhost:${port}/webrtc?sessionId=test&deviceId=device2&isMain=false`);
      
      let connected = 0;
      const onOpen = () => {
        connected++;
        if (connected === 2) {
          // Both clients connected, send test message
          ws1?.send(JSON.stringify({ type: 'test', data: 'hello' }));
        }
      };

      ws2.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          expect(message.type).toBe('test');
          expect(message.data).toBe('hello');
          cleanup();
          done();
        } catch (error) {
          cleanup();
          done(error);
        }
      });

      ws1.on('open', onOpen);
      ws2.on('open', onOpen);

      ws1.on('error', (error) => {
        cleanup();
        done(new Error(error instanceof Error ? error.message : 'WebSocket error'));
      });

      ws2.on('error', (error) => {
        cleanup();
        done(new Error(error instanceof Error ? error.message : 'WebSocket error'));
      });
    } catch (error) {
      cleanup();
      done(error instanceof Error ? error : new Error('Unknown error'));
    }
  }, 10000);

  test('should store session data in Redis', (done) => {
    const sessionId = 'test-session';
    const ws = new WebSocket(`ws://localhost:${port}/webrtc?sessionId=${sessionId}&deviceId=test&isMain=true`);
    
    ws.on('open', async () => {
      try {
        // Wait for Redis to be updated
        await new Promise(resolve => setTimeout(resolve, 500));
        const sessionData = await redis.get(`ws:session:${sessionId}`);
        expect(sessionData).toBeTruthy();
        const data = JSON.parse(sessionData!);
        expect(data.isMain).toBe(true);
        ws.close();
        done();
      } catch (error) {
        ws.close();
        done(new Error(error instanceof Error ? error.message : 'WebSocket error'));
      }
    });

    ws.on('error', (error) => {
      ws.close();
      done(new Error(error instanceof Error ? error.message : 'WebSocket error'));
    });
  }, 10000);

  test('should handle reconnection', (done) => {
    const ws = new WebSocket(`ws://localhost:${port}/webrtc?sessionId=test&deviceId=test&isMain=true`);
    
    ws.on('open', () => {
      ws.close();
      const ws2 = new WebSocket(`ws://localhost:${port}/webrtc?sessionId=test&deviceId=test&isMain=true`);
      ws2.on('open', () => {
        expect(ws2.readyState).toBe(WebSocket.OPEN);
        ws2.close();
        done();
      });

      ws2.on('error', (error) => {
        ws2.close();
        done(new Error(error instanceof Error ? error.message : 'WebSocket error'));
      });
    });

    ws.on('error', (error) => {
      ws.close();
      done(new Error(error instanceof Error ? error.message : 'WebSocket error'));
    });
  }, 10000);
}); 
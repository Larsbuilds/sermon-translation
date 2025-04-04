// Mock Redis
jest.mock('ioredis', () => {
  const data = new Map<string, string>();
  const sets = new Map<string, Set<string>>();

  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    flushall: jest.fn(() => Promise.resolve('OK')),
    quit: jest.fn(() => Promise.resolve('OK')),
    set: jest.fn((key: string, value: string) => {
      data.set(key, value);
      return Promise.resolve('OK');
    }),
    get: jest.fn((key: string) => {
      return Promise.resolve(data.get(key) || null);
    }),
    del: jest.fn((key: string) => {
      return Promise.resolve(data.delete(key) ? 1 : 0);
    }),
    sadd: jest.fn((key: string, ...members: string[]) => {
      if (!sets.has(key)) {
        sets.set(key, new Set());
      }
      const set = sets.get(key)!;
      members.forEach(m => set.add(m));
      return Promise.resolve(members.length);
    }),
    srem: jest.fn((key: string, ...members: string[]) => {
      if (!sets.has(key)) {
        return Promise.resolve(0);
      }
      const set = sets.get(key)!;
      let removed = 0;
      members.forEach(m => {
        if (set.delete(m)) {
          removed++;
        }
      });
      return Promise.resolve(removed);
    }),
    expire: jest.fn(() => Promise.resolve(1))
  }));
});

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import { WebSocket } from 'ws';
import Redis from 'ioredis';
import { startServer, cleanup } from '../../server/websocket';
import { createServer, Server } from 'http';

describe('WebSocket Server Integration', () => {
  let redis: Redis;
  let wss: ReturnType<typeof startServer>;
  let httpServer: Server;
  let port: number;

  beforeAll(async () => {
    // Create Redis instance
    redis = new Redis();

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
    try {
      // Close all WebSocket connections and cleanup WebSocket server
      await cleanup();

      // Close HTTP server
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });

      // Clear Redis database
      await redis.flushall();

      // Close test Redis connection
      await redis.quit();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }, 30000); // Increase timeout to 30 seconds

  beforeEach(async () => {
    // Clear Redis database before each test
    await redis.flushall();
  });

  afterEach(async () => {
    // Close all WebSocket connections
    wss.clients.forEach((client) => {
      client.close();
    });

    // Wait for all connections to close
    await new Promise<void>((resolve) => {
      const checkConnections = () => {
        if (wss.clients.size === 0) {
          resolve();
        } else {
          setTimeout(checkConnections, 100);
        }
      };
      checkConnections();
    });
  });

  test('should connect to WebSocket server', (done) => {
    const ws = new WebSocket(`ws://localhost:${port}/webrtc?sessionId=test&deviceId=test&isMain=true`, {
      headers: {
        origin: 'http://localhost:3000'
      }
    });
    
    ws.on('open', () => {
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
      done();
    });

    ws.on('error', (error) => {
      ws.close();
      done(new Error(error instanceof Error ? error.message : 'WebSocket error'));
    });
  }, 10000);

  test('should handle missing parameters', (done) => {
    const ws = new WebSocket(`ws://localhost:${port}/webrtc`, {
      headers: {
        origin: 'http://localhost:3000'
      }
    });
    
    ws.on('close', (code) => {
      expect(code).toBe(4000); // Bad request
      done();
    });

    ws.on('error', (error) => {
      // Ignore connection errors as we expect the server to close the connection
      if (error instanceof Error && error.message.includes('403')) {
        return;
      }
      done(error);
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
      ws1 = new WebSocket(`ws://localhost:${port}/webrtc?sessionId=test&deviceId=device1&isMain=true`, {
        headers: {
          origin: 'http://localhost:3000'
        }
      });
      ws2 = new WebSocket(`ws://localhost:${port}/webrtc?sessionId=test&deviceId=device2&isMain=false`, {
        headers: {
          origin: 'http://localhost:3000'
        }
      });
      
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
        } catch (err) {
          cleanup();
          done(err instanceof Error ? err : new Error('Failed to parse message'));
        }
      });

      ws1.on('open', onOpen);
      ws2.on('open', onOpen);

      ws1.on('error', (error: Error) => {
        cleanup();
        done(error);
      });

      ws2.on('error', (error: Error) => {
        cleanup();
        done(error);
      });
    } catch (error) {
      cleanup();
      done(error instanceof Error ? error : new Error('Failed to setup WebSocket connections'));
    }
  }, 10000);

  test('should store session data in Redis', (done) => {
    const sessionId = 'test-session';
    const ws = new WebSocket(`ws://localhost:${port}/webrtc?sessionId=${sessionId}&deviceId=test&isMain=true`, {
      headers: {
        origin: 'http://localhost:3000'
      }
    });
    
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
        done(error instanceof Error ? error : new Error('Failed to verify session data'));
      }
    });

    ws.on('error', (error) => {
      ws.close();
      done(new Error(error instanceof Error ? error.message : 'WebSocket error'));
    });
  }, 10000);

  test('should handle reconnection', (done) => {
    const ws = new WebSocket(`ws://localhost:${port}/webrtc?sessionId=test&deviceId=test&isMain=true`, {
      headers: {
        origin: 'http://localhost:3000'
      }
    });
    
    ws.on('open', () => {
      ws.close();
      const ws2 = new WebSocket(`ws://localhost:${port}/webrtc?sessionId=test&deviceId=test&isMain=true`, {
        headers: {
          origin: 'http://localhost:3000'
        }
      });
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
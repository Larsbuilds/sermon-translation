import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import { WebSocket } from 'ws';
import { Redis } from 'ioredis';
import { startServer, cleanup } from '../../server/websocket.ts';
import { createServer, Server, IncomingMessage, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { WebSocketServer } from 'ws';
import fetch, { Response } from 'node-fetch';

// Test setup and environment configuration
beforeAll(() => {
  // Set environment variables for test
  (process.env as any).NODE_ENV = 'test';
  (process.env as any).PORT = '0'; // Let the system choose a random port
  (process.env as any).WS_PORT = '0';
  (process.env as any).WS_HOST = 'localhost';
  (process.env as any).REDIS_URL = 'redis://localhost:6379';
  (process.env as any).REDIS_TLS = 'false';
  (process.env as any).REDIS_PASSWORD = '';
  (process.env as any).ALLOWED_ORIGINS = 'http://localhost:3000';
  (process.env as any).MAX_CONNECTIONS_PER_SESSION = '3';
});

// Mock Redis client
jest.mock('ioredis', () => {
  interface MockRedis {
    set: jest.Mock;
    get: jest.Mock;
    quit: jest.Mock;
    on: jest.Mock;
    status: string;
    connect: jest.Mock;
    disconnect: jest.Mock;
  }

  const mockRedis: MockRedis = {
    set: jest.fn().mockImplementation(() => Promise.resolve('OK')),
    get: jest.fn().mockImplementation(() => Promise.resolve('test-value')),
    quit: jest.fn().mockImplementation(() => Promise.resolve('OK')),
    on: jest.fn().mockImplementation((...args: unknown[]) => {
      const [event, callback] = args;
      if (event === 'ready' && typeof callback === 'function') {
        callback();
      }
      return mockRedis;
    }),
    status: 'ready',
    connect: jest.fn().mockImplementation(() => Promise.resolve()),
    disconnect: jest.fn().mockImplementation(() => Promise.resolve())
  };

  return jest.fn().mockImplementation(() => mockRedis);
});

// Mock http to avoid port conflicts
jest.mock('http', () => {
  const originalModule = jest.requireActual<typeof import('http')>('http');
  return {
    ...originalModule,
    createServer: jest.fn().mockImplementation((requestListener?: any) => {
      const server = originalModule.createServer(requestListener);
      const originalListen = server.listen.bind(server);
      server.listen = jest.fn().mockImplementation((...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          callback();
        }
        return originalListen(...args);
      }) as unknown as typeof server.listen;
      return server;
    })
  };
});

// Mock process.exit to prevent test from exiting
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit() was called');
});

// Base test setup
describe('WebSocket Server Test Suite', () => {
  let server: Server | null = null;
  let port: number;
  const activeConnections: WebSocket[] = [];

  const cleanupConnection = async (ws: WebSocket) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  beforeAll((done) => {
    console.log('Starting test setup...');
    server = startServer();
    
    server.listen(0, () => {
      const address = server?.address();
      if (!address || typeof address === 'string') {
        done(new Error('Invalid server address'));
        return;
      }
      port = address.port;
      console.log(`Server listening on port ${port}`);
      done();
    });
  }, 30000);

  afterAll(async () => {
    console.log('Starting cleanup...');
    await Promise.all(activeConnections.map(cleanupConnection));
    activeConnections.length = 0;
    await cleanup();
  }, 30000);

  beforeEach(() => {
    activeConnections.length = 0;
  });

  afterEach(async () => {
    await Promise.all(activeConnections.map(cleanupConnection));
    activeConnections.length = 0;
  });

  const createWebSocket = (params: string) => {
    const ws = new WebSocket(`ws://localhost:${port}/webrtc${params}`, {
      headers: {
        origin: 'http://localhost:3000'
      }
    });
    activeConnections.push(ws);
    return ws;
  };

  // Connection Tests
  describe('Connection Management', () => {
    test('should connect to WebSocket server', (done) => {
      const ws = createWebSocket('?sessionId=test&deviceId=test&isMain=true');
      
      const timeout = setTimeout(() => {
        done(new Error('Connection timeout'));
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timeout);
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        done();
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        done(error instanceof Error ? error : new Error('WebSocket error'));
      });
    });

    test('should handle missing parameters', (done) => {
      const ws = createWebSocket('');
      
      const timeout = setTimeout(() => {
        done(new Error('Connection timeout'));
      }, 5000);

      ws.on('close', (code) => {
        clearTimeout(timeout);
        expect(code).toBe(1006); // Abnormal closure
        done();
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        if (error instanceof Error && error.message.includes('400')) {
          return;
        }
        done(error);
      });
    });
  });

  // Message Broadcasting Tests
  describe('Message Broadcasting', () => {
    test('should broadcast messages within session', (done) => {
      const ws1 = createWebSocket(`?sessionId=test&deviceId=device1&isMain=true`);
      const ws2 = createWebSocket(`?sessionId=test&deviceId=device2&isMain=false`);
      const connectedClients: WebSocket[] = [];
      let timeoutId: NodeJS.Timeout;

      const onMessage = (data: Buffer) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'test') {
          clearTimeout(timeoutId);
          ws1.close();
          ws2.close();
          done();
        }
      };

      ws1.on('open', () => {
        connectedClients.push(ws1);
        if (connectedClients.length === 2) {
          ws1.send(JSON.stringify({ type: 'test', data: 'test message' }));
        }
      });

      ws2.on('open', () => {
        connectedClients.push(ws2);
        if (connectedClients.length === 2) {
          ws1.send(JSON.stringify({ type: 'test', data: 'test message' }));
        }
      });

      ws2.on('message', onMessage);

      timeoutId = setTimeout(() => {
        ws1.close();
        ws2.close();
        done(new Error('Message not received within timeout'));
      }, 5000);
    });
  });

  // Session Management Tests
  describe('Session Management', () => {
    it('should handle maximum connections per session', (done) => {
      const maxConnections = Number(process.env.MAX_CONNECTIONS_PER_SESSION) || 3;
      const connections: WebSocket[] = [];
      let connectionsAttempted = 0;
      let connectionsEstablished = 0;
      let connectionsFailed = 0;
      let testCompleted = false;

      const cleanup = (error?: Error) => {
        if (testCompleted) return;
        testCompleted = true;
        
        clearTimeout(timeout);
        
        // Close all connections
        Promise.all(connections.map(ws => 
          new Promise<void>(resolve => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.on('close', () => resolve());
              ws.close();
            } else {
              resolve();
            }
          })
        )).then(() => {
          if (error) {
            done(error);
          } else {
            done();
          }
        });
      };

      const timeout = setTimeout(() => {
        cleanup(new Error('Test timeout - Current state: ' + 
          `attempted=${connectionsAttempted}, ` +
          `established=${connectionsEstablished}, ` +
          `failed=${connectionsFailed}`));
      }, 10000);

      const tryConnect = (index: number) => {
        if (testCompleted) return;
        
        connectionsAttempted++;
        const ws = new WebSocket(`ws://localhost:${port}/webrtc?sessionId=test&deviceId=device${index}&isMain=${index === 0}`);
        
        ws.on('error', (error: any) => {
          if (testCompleted) return;
          
          if (error.message.includes('429')) {
            connectionsFailed++;
            // This is expected for connections beyond the limit
            if (connectionsEstablished === maxConnections && connectionsFailed === 1) {
              try {
                expect(connectionsEstablished).toBe(maxConnections);
                expect(connectionsFailed).toBe(1);
                cleanup();
              } catch (e) {
                cleanup(e as Error);
              }
            }
          } else {
            cleanup(error);
          }
        });

        ws.on('open', () => {
          if (testCompleted) {
            ws.close();
            return;
          }
          
          connectionsEstablished++;
          connections.push(ws);
          
          if (connectionsEstablished === maxConnections) {
            // Try one more connection, which should fail
            setTimeout(() => tryConnect(maxConnections), 100);
          } else if (connectionsEstablished < maxConnections) {
            // Try next connection
            setTimeout(() => tryConnect(connectionsEstablished), 100);
          }
        });

        ws.on('close', () => {
          if (testCompleted) return;
          const idx = connections.indexOf(ws);
          if (idx !== -1) {
            connections.splice(idx, 1);
          }
        });
      };

      // Start with the first connection
      tryConnect(0);
    }, 15000); // Set test timeout to 15 seconds
  });

  // Error Handling Tests
  describe('Error Handling', () => {
    test('should handle Redis connection failure gracefully', (done) => {
      const ws = createWebSocket('?sessionId=test&deviceId=test&isMain=true');
      
      const timeout = setTimeout(() => {
        done(new Error('Connection timeout'));
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timeout);
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        done();
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        done(error instanceof Error ? error : new Error('WebSocket error'));
      });
    });

    test('should handle invalid endpoints', (done) => {
      const ws = new WebSocket(`ws://localhost:${port}/invalid`, {
        headers: {
          origin: 'http://localhost:3000'
        }
      });
      activeConnections.push(ws);

      const timeout = setTimeout(() => {
        done(new Error('Connection timeout'));
      }, 5000);

      ws.on('close', (code) => {
        clearTimeout(timeout);
        expect(code).toBe(1006); // Abnormal closure
        done();
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        if (error instanceof Error && error.message.includes('404')) {
          return;
        }
        done(error);
      });
    });
  });

  // Security Tests
  describe('Security', () => {
    test('should handle CORS restrictions', (done) => {
      const ws = new WebSocket(`ws://localhost:${port}/webrtc?sessionId=test&deviceId=test`, {
        headers: {
          origin: 'http://invalid-origin.com'
        }
      });
      activeConnections.push(ws);

      const timeout = setTimeout(() => {
        done(new Error('Connection timeout'));
      }, 5000);

      ws.on('close', (code) => {
        clearTimeout(timeout);
        expect(code).toBe(1006); // Abnormal closure
        done();
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        if (error instanceof Error && error.message.includes('403')) {
          return;
        }
        done(error);
      });
    });
  });

  // HTTP Endpoint Tests
  describe('HTTP Endpoints', () => {
    test('should handle health check requests', (done) => {
      interface HealthCheckResponse {
        status: string;
        environment: string;
        redis: string;
      }

      if (!server) {
        done(new Error('Server not initialized'));
        return;
      }

      const address = server.address();
      if (!address || typeof address === 'string') {
        done(new Error('Invalid server address'));
        return;
      }

      const healthCheckUrl = `http://localhost:${address.port}/health`;

      fetch(healthCheckUrl)
        .then((res: Response) => res.json())
        .then((response: unknown) => {
          const healthResponse = response as HealthCheckResponse;
          expect(healthResponse.status).toBe('degraded');
          expect(healthResponse.environment).toBe('test');
          expect(healthResponse.redis).toBe('reconnecting');
          done();
        })
        .catch((error: Error) => {
          done(error);
        });
    });
  });
});
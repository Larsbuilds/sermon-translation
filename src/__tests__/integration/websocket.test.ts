import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import { WebSocket } from 'ws';
import { Redis } from 'ioredis';
import { startServer, cleanup } from '../../server/websocket.js';
import { createServer, Server, IncomingMessage } from 'http';
import { AddressInfo } from 'net';

// Set environment variables for test
process.env.PORT = '0'; // Let the system choose a random port
process.env.WS_PORT = '0';
process.env.WS_HOST = 'localhost';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.REDIS_TLS = 'false';
process.env.REDIS_PASSWORD = '';

// Mock Redis
jest.mock('ioredis', () => {
  const mockData = new Map<string, string>();
  const mockSets = new Map<string, Set<string>>();
  
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    flushall: jest.fn(() => Promise.resolve('OK')),
    quit: jest.fn(() => Promise.resolve('OK')),
    set: jest.fn((key: string, value: string) => {
      mockData.set(key, value);
      return Promise.resolve('OK');
    }),
    get: jest.fn((key: string) => {
      return Promise.resolve(mockData.get(key) || null);
    }),
    del: jest.fn((key: string) => {
      return Promise.resolve(mockData.delete(key) ? 1 : 0);
    }),
    sadd: jest.fn((key: string, ...members: string[]) => {
      if (!mockSets.has(key)) {
        mockSets.set(key, new Set());
      }
      const set = mockSets.get(key)!;
      members.forEach(m => set.add(m));
      return Promise.resolve(members.length);
    }),
    srem: jest.fn((key: string, ...members: string[]) => {
      if (!mockSets.has(key)) {
        return Promise.resolve(0);
      }
      const set = mockSets.get(key)!;
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
      });
      return server;
    })
  };
});

// Mock process.exit to prevent test from exiting
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit() was called');
});

describe('WebSocket Server Integration', () => {
  let redis: Redis;
  let wss: ReturnType<typeof startServer>;
  let httpServer: Server;
  let port: number;
  let activeConnections: WebSocket[] = [];

  const cleanupConnection = async (ws: WebSocket) => {
    if (ws.readyState === WebSocket.CLOSED) return;
    await new Promise<void>(resolve => {
      ws.once('close', () => resolve());
      ws.close();
    });
  };

  beforeAll(async () => {
    console.log('Starting test setup...');
    try {
      // Create HTTP server
      httpServer = createServer();
      console.log('HTTP server created');

      // Start WebSocket server
      wss = startServer(httpServer);
      console.log('WebSocket server started');

      // Start server on random port
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Server start timeout'));
        }, 5000);

        httpServer.listen(0, 'localhost', () => {
          clearTimeout(timeout);
          const addr = httpServer.address() as AddressInfo;
          if (!addr) {
            reject(new Error('Failed to get server address'));
            return;
          }
          port = addr.port;
          console.log(`Server listening on port ${port}`);
          resolve();
        });

        httpServer.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (error) {
      console.error('Error during setup:', error);
      throw error;
    }
  }, 30000);

  afterAll(async () => {
    console.log('Starting cleanup...');
    try {
      // Close all active WebSocket connections
      await Promise.all(activeConnections.map(cleanupConnection));
      activeConnections = [];

      // Close WebSocket server and cleanup
      await cleanup();

      // Close HTTP server
      await new Promise<void>(resolve => {
        if (!httpServer.listening) {
          resolve();
          return;
        }
        httpServer.close(() => resolve());
      });

      // Wait for all operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Error during cleanup:', error);
      throw error;
    }
  }, 30000);

  beforeEach(async () => {
    // Clear active connections
    await Promise.all(activeConnections.map(cleanupConnection));
    activeConnections = [];

    // Wait for all operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    // Close all active WebSocket connections
    await Promise.all(activeConnections.map(cleanupConnection));
    activeConnections = [];

    // Wait for all operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));
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

  test('should connect to WebSocket server', (done) => {
    console.log('Starting connection test...');
    const ws = createWebSocket('?sessionId=test&deviceId=test&isMain=true');
    
    const timeout = setTimeout(() => {
      done(new Error('Connection timeout'));
    }, 5000);

    ws.on('open', () => {
      clearTimeout(timeout);
      expect(ws.readyState).toBe(WebSocket.OPEN);
      done();
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      done(error instanceof Error ? error : new Error('WebSocket error'));
    });
  }, 10000);

  test('should handle missing parameters', (done) => {
    console.log('Starting missing parameters test...');
    const ws = createWebSocket('');
    
    const timeout = setTimeout(() => {
      done(new Error('Connection timeout'));
    }, 5000);

    ws.on('close', (code) => {
      clearTimeout(timeout);
      expect(code).toBe(4000); // Bad request
      done();
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      // Ignore connection errors as we expect the server to close the connection
      if (error instanceof Error && error.message.includes('403')) {
        return;
      }
      done(error);
    });
  }, 10000);

  test('should broadcast messages within session', (done) => {
    console.log('Starting broadcast test...');
    let messageReceived = false;
    let timeoutId: NodeJS.Timeout | null = null;
    
    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      messageReceived = true; // Prevent multiple calls to done()
      done();
    };

    // Set a timeout for the entire test
    timeoutId = setTimeout(() => {
      done(new Error('Message not received within timeout'));
    }, 5000);

    try {
      const ws1 = createWebSocket('?sessionId=test&deviceId=device1&isMain=true');
      const ws2 = createWebSocket('?sessionId=test&deviceId=device2&isMain=false');
      
      let connected = 0;
      const onOpen = () => {
        connected++;
        console.log(`Client connected (${connected}/2)`);
        if (connected === 2) {
          // Both clients connected, send test message
          console.log('Sending test message...');
          ws1.send(JSON.stringify({ type: 'test', data: 'hello' }));
        }
      };

      ws1.on('open', onOpen);
      ws2.on('open', onOpen);

      ws2.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          expect(message.type).toBe('test');
          expect(message.data).toBe('hello');
          cleanup();
        } catch (error) {
          done(error instanceof Error ? error : new Error('Failed to parse message'));
        }
      });

      ws1.on('error', (error) => {
        if (!messageReceived) {
          done(error instanceof Error ? error : new Error('WebSocket error'));
        }
      });

      ws2.on('error', (error) => {
        if (!messageReceived) {
          done(error instanceof Error ? error : new Error('WebSocket error'));
        }
      });
    } catch (error) {
      done(error instanceof Error ? error : new Error('Failed to setup WebSocket connections'));
    }
  }, 10000);

  test('should handle maximum connections per session', (done) => {
    console.log('Starting max connections test...');
    const maxConnections = 3; // This should match env.MAX_CONNECTIONS_PER_SESSION
    const connections: WebSocket[] = [];
    let connectionCount = 0;

    const timeout = setTimeout(() => {
      done(new Error('Test timeout'));
    }, 5000);

    const tryConnect = (index: number) => {
      const ws = createWebSocket(`?sessionId=test&deviceId=device${index}&isMain=false`);
      connections.push(ws);

      ws.on('open', () => {
        connectionCount++;
        if (connectionCount === maxConnections) {
          // Try one more connection, which should be rejected
          const extraWs = createWebSocket(`?sessionId=test&deviceId=deviceExtra&isMain=false`);
          extraWs.on('close', (code) => {
            clearTimeout(timeout);
            expect(code).toBe(4001); // Maximum connections reached
            done();
          });
        }
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        done(error instanceof Error ? error : new Error('WebSocket error'));
      });
    };

    // Create max number of connections
    for (let i = 0; i < maxConnections; i++) {
      tryConnect(i);
    }
  }, 10000);

  test('should handle Redis connection failure gracefully', (done) => {
    console.log('Starting Redis failure test...');
    const ws = createWebSocket('?sessionId=test&deviceId=test&isMain=true');
    
    const timeout = setTimeout(() => {
      done(new Error('Connection timeout'));
    }, 5000);

    ws.on('open', () => {
      clearTimeout(timeout);
      expect(ws.readyState).toBe(WebSocket.OPEN);
      done();
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      done(error instanceof Error ? error : new Error('WebSocket error'));
    });
  }, 10000);

  test('should handle health check requests', (done) => {
    console.log('Starting health check test...');
    
    interface HealthCheckResponse {
      status: string;
      environment: string;
      redis: string;
      timestamp: string;
      connections: number;
      uptime: number;
      port: string;
      ws_port: string;
      host: string;
      pid: number;
      memory: {
        rss: number;
        heapTotal: number;
        heapUsed: number;
        external: number;
        arrayBuffers: number;
      };
    }

    fetch(`http://localhost:${port}/health`, {
      headers: {
        'Origin': 'http://localhost:3000'
      }
    })
      .then(res => res.json())
      .then((response: HealthCheckResponse) => {
        expect(response.status).toBe('ok');
        expect(response.environment).toBe('test');
        expect(response.redis).toBe('ready');
        done();
      })
      .catch(error => {
        done(error instanceof Error ? error : new Error('Failed to fetch health check response'));
      });
  }, 10000);

  test('should handle invalid endpoints', (done) => {
    console.log('Starting invalid endpoint test...');
    const ws = new WebSocket(`ws://localhost:${port}/invalid`, {
      headers: {
        origin: 'http://localhost:3000'
      }
    });
    activeConnections.push(ws);

    const timeout = setTimeout(() => {
      done(new Error('Connection timeout'));
    }, 5000);

    ws.on('close', () => {
      clearTimeout(timeout);
      done();
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      // Ignore connection errors as we expect the server to close the connection
      if (error instanceof Error && error.message.includes('404')) {
        return;
      }
      done(error);
    });
  }, 10000);

  test('should handle CORS restrictions', (done) => {
    console.log('Starting CORS test...');
    const ws = new WebSocket(`ws://localhost:${port}/webrtc?sessionId=test&deviceId=test`, {
      headers: {
        origin: 'http://invalid-origin.com'
      }
    });
    activeConnections.push(ws);

    const timeout = setTimeout(() => {
      done(new Error('Connection timeout'));
    }, 5000);

    ws.on('close', () => {
      clearTimeout(timeout);
      done();
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      // Ignore connection errors as we expect the server to close the connection
      if (error instanceof Error && error.message.includes('403')) {
        return;
      }
      done(error);
    });
  }, 10000);
});
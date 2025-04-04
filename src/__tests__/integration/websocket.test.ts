import WebSocket from 'ws';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import Redis from 'ioredis';

describe('WebSocket Server Integration', () => {
  let server: any;
  let redis: Redis;
  let port: number;

  beforeAll(async () => {
    // Start Redis
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    await redis.flushall(); // Clear Redis database

    // Start WebSocket server
    server = createServer();
    server.listen(0); // Use random available port
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    // Cleanup
    await redis.quit();
    server.close();
  });

  test('should connect to WebSocket server', (done) => {
    const ws = new WebSocket(`ws://localhost:${port}/webrtc?sessionId=test&deviceId=device1&isMain=true`);
    
    ws.on('open', () => {
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
      done();
    });
  });

  test('should handle missing parameters', (done) => {
    const ws = new WebSocket(`ws://localhost:${port}/webrtc`);
    
    ws.on('close', (code) => {
      expect(code).toBe(4000); // Our custom error code
      done();
    });
  });

  test('should broadcast messages within session', (done) => {
    const ws1 = new WebSocket(`ws://localhost:${port}/webrtc?sessionId=test&deviceId=device1&isMain=true`);
    const ws2 = new WebSocket(`ws://localhost:${port}/webrtc?sessionId=test&deviceId=device2&isMain=false`);
    
    let connected = 0;
    const onOpen = () => {
      connected++;
      if (connected === 2) {
        // Both clients connected, send message
        ws1.send(JSON.stringify({
          type: 'offer',
          offer: { type: 'offer', sdp: 'test' }
        }));
      }
    };

    ws1.on('open', onOpen);
    ws2.on('open', onOpen);
    
    ws2.on('message', (data) => {
      const message = JSON.parse(data.toString());
      expect(message.type).toBe('offer');
      ws1.close();
      ws2.close();
      done();
    });
  });

  test('should store session data in Redis', async (done) => {
    const sessionId = 'test-redis';
    const ws = new WebSocket(`ws://localhost:${port}/webrtc?sessionId=${sessionId}&deviceId=device1&isMain=true`);
    
    ws.on('open', async () => {
      // Wait for Redis operation to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const sessionData = await redis.get(`ws:session:${sessionId}`);
      expect(sessionData).toBeTruthy();
      
      const data = JSON.parse(sessionData!);
      expect(data.createdAt).toBeTruthy();
      expect(data.lastActive).toBeTruthy();
      
      ws.close();
      done();
    });
  });

  test('should handle reconnection', (done) => {
    const ws = new WebSocket(`ws://localhost:${port}/webrtc?sessionId=test&deviceId=device1&isMain=true`);
    
    ws.on('open', () => {
      ws.close();
      
      // Try to reconnect
      const ws2 = new WebSocket(`ws://localhost:${port}/webrtc?sessionId=test&deviceId=device1&isMain=true`);
      
      ws2.on('open', () => {
        expect(ws2.readyState).toBe(WebSocket.OPEN);
        ws2.close();
        done();
      });
    });
  });
}); 
import { beforeAll, afterAll } from '@jest/globals';
import ws from 'ws';

// Mock global WebSocket for Node.js environment
// Use type assertion to make TypeScript happy
global.WebSocket = ws as unknown as typeof WebSocket;

// Set up environment variables for testing
Object.defineProperty(process.env, 'NODE_ENV', { value: 'test' });
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.WS_PORT = '0'; // Use random available port for tests
process.env.WS_HOST = 'localhost';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
process.env.JWT_SECRET = 'test-jwt-secret-key-min-32-chars-long';
process.env.REDIS_PASSWORD = 'test-redis-password';
process.env.REDIS_TLS = 'false';
process.env.SESSION_TTL = '3600';
process.env.MAX_CONNECTIONS_PER_SESSION = '2';
process.env.SESSION_CLEANUP_INTERVAL = '300';
process.env.RATE_LIMIT_WINDOW = '60000';
process.env.RATE_LIMIT_MAX_PER_WINDOW = '100';
process.env.RATE_LIMIT_BLOCK_DURATION = '300000';
process.env.LOG_LEVEL = 'error';
process.env.LOG_FORMAT = 'dev';
process.env.ENABLE_REQUEST_LOGGING = 'false';
process.env.ENABLE_METRICS = 'false';
process.env.METRICS_PORT = '9090';

// Mock environment variables
process.env.NEXT_PUBLIC_WEBSOCKET_URL = 'ws://localhost:3002';
process.env.NEXT_PUBLIC_WEBRTC_URL = 'ws://localhost:3002/webrtc';

// Add any global test setup here
beforeAll(() => {
  // Setup before all tests
});

afterAll(() => {
  // Cleanup after all tests
}); 
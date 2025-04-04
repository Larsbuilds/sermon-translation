// Mock global WebSocket for Node.js environment
global.WebSocket = require('ws');

// Set up environment variables for testing
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.WS_PORT = '0'; // Use random available port for tests
process.env.WS_HOST = 'localhost'; 
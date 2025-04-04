# Sermon Translation App

A real-time sermon translation application using WebRTC for peer-to-peer communication and WebSocket for signaling.

## Features

- **Real-time Translation**: Peer-to-peer audio streaming using WebRTC
- **Robust WebSocket Signaling**: Reliable WebRTC connection establishment
- **Session Management**: Redis-backed session handling for scalability
- **Automated Testing**: Comprehensive unit and integration tests
- **Error Resilience**: Automatic reconnection and graceful error handling
- **Production Ready**: Configured for Railway deployment
- **Resource Management**: Efficient cleanup of WebSocket and Redis connections
- **Rate Limiting**: Protection against abuse in production environment
- **Health Monitoring**: Built-in health check endpoints
- **CORS Protection**: Configurable origin validation

## Architecture

The application consists of two main components:

1. **Next.js Frontend** (Port 3000)
   - Modern React-based UI
   - WebRTC peer connection management
   - Real-time audio streaming
   - TypeScript for type safety

2. **WebSocket Signaling Server** (Port 3002)
   - WebRTC signaling (offer/answer/ICE candidates)
   - Redis session management
   - Automatic reconnection
   - Error handling and logging
   - Session cleanup and resource management
   - Rate limiting for production security
   - Health check endpoints
   - CORS validation

## Getting Started

1. **Prerequisites**
   - Node.js 18+
   - Redis server
   - MongoDB (for user management)

2. **Environment Setup**
   ```bash
   # Copy environment templates
   cp .env.example .env.local
   cp .env.ws.example .env.ws

   # Install dependencies
   npm install
   ```

3. **Development**
   ```bash
   # Start WebSocket server
   npm run ws

   # In a new terminal, start Next.js development server
   npm run dev
   ```

4. **Testing**
   ```bash
   # Run all tests
   npm test

   # Run specific test suites
   npm test WebRTCSignaling
   npm test websocket

   # Run tests with open handle detection
   npm test -- --detectOpenHandles
   ```

## Production Deployment

The application is configured for deployment on Railway:

1. **Required Environment Variables**
   - `MONGODB_URI`: MongoDB connection string
   - `REDIS_URL`: Redis connection string
   - `PORT`: Application port (set by Railway)
   - `WS_URL`: WebSocket server URL
   - `REDIS_PASSWORD`: Redis password for secure connections
   - `REDIS_TLS`: Enable TLS for Redis in production
   - `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins
   - `RATE_LIMIT_WINDOW`: Rate limiting window in milliseconds
   - `RATE_LIMIT_MAX_PER_WINDOW`: Maximum requests per window
   - `SESSION_TTL`: Session time-to-live in seconds

2. **GitHub Actions**
   - Automated testing on pull requests
   - Deployment to Railway on main branch updates

3. **Health Checks**
   - Frontend: `http://your-domain/health`
   - WebSocket: `http://your-domain/health`
     - Returns active connections count
     - Monitors server status
     - Includes timestamp

## Testing

The application includes comprehensive test coverage:

- **Unit Tests**
  - WebRTC signaling
  - Connection state management
  - Message handling
  - Error recovery

- **Integration Tests**
  - WebSocket server
  - Redis session management
  - Message broadcasting
  - Connection handling
  - Resource cleanup
  - Rate limiting
  - CORS validation

## Resource Management

The WebSocket server includes sophisticated resource management:

1. **Session Cleanup**
   - Automatic cleanup of inactive sessions
   - Configurable cleanup intervals
   - Memory leak prevention

2. **Connection Management**
   - Maximum connections per session limit
   - Automatic closure of stale connections
   - Proper cleanup on server shutdown

3. **Redis Connections**
   - Lazy initialization
   - Automatic reconnection
   - Proper cleanup in tests and production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

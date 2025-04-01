import { WebSocketServer, WebSocket as WS } from 'ws';
import { createServer } from 'http';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables from .env.ws
config({ path: path.resolve(process.cwd(), '.env.ws') });

const wss = new WebSocketServer({ noServer: true });

// Store active connections
const connections = new Map<string, Set<WS>>();

wss.on('connection', (ws: WS, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId');
  const clientIp = req.socket.remoteAddress;

  console.log(`New connection attempt from ${clientIp}`);
  console.log(`Request URL: ${req.url}`);

  if (!sessionId) {
    console.log('Connection rejected: No session ID provided');
    ws.close(1008, 'Session ID is required');
    return;
  }

  // Add to connections
  if (!connections.has(sessionId)) {
    connections.set(sessionId, new Set());
    console.log(`Created new session: ${sessionId}`);
  }
  connections.get(sessionId)!.add(ws);

  console.log(`Client connected to session ${sessionId}`);
  console.log(`Active sessions: ${connections.size}`);
  console.log(`Active connections in session ${sessionId}: ${connections.get(sessionId)!.size}`);

  ws.on('message', (data: Buffer) => {
    try {
      const parsedData = JSON.parse(data.toString());
      console.log(`Received message in session ${sessionId}:`, {
        type: parsedData.type,
        dataSize: data.length
      });
      
      // Broadcast to all other clients in the same session
      const sessionConnections = connections.get(sessionId);
      if (sessionConnections) {
        sessionConnections.forEach((client) => {
          if (client !== ws && client.readyState === WS.OPEN) {
            client.send(JSON.stringify(parsedData));
            console.log(`Broadcasted message to client in session ${sessionId}`);
          }
        });
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });

  ws.on('close', () => {
    // Remove from connections
    const sessionConnections = connections.get(sessionId);
    if (sessionConnections) {
      sessionConnections.delete(ws);
      if (sessionConnections.size === 0) {
        connections.delete(sessionId);
        console.log(`Session ${sessionId} closed - no more connections`);
      }
    }
    console.log(`Client disconnected from session ${sessionId}`);
    console.log(`Remaining active sessions: ${connections.size}`);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error in session ${sessionId}:`, error);
  });
});

const server = createServer();

// Add healthcheck endpoint
server.on('request', (req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy' }));
    return;
  }
});

server.on('upgrade', (request, socket, head) => {
  console.log('Received upgrade request');
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

const PORT = parseInt(process.env.WS_PORT || '3001', 10);
const HOST = process.env.WS_HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`WebSocket server is running on ${HOST}:${PORT}`);
  console.log('Environment:', process.env.NODE_ENV);
  console.log('WS_HOST:', process.env.WS_HOST);
  console.log('WS_PORT:', process.env.WS_PORT);
}); 
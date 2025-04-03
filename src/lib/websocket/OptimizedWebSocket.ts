import { EventEmitter } from 'events';
import pako from 'pako';

interface WebSocketConfig {
  url: string;
  sessionId: string;
  deviceId: string;
  isMain: boolean;
  reconnectAttempts?: number;
  reconnectTimeout?: number;
  heartbeatInterval?: number;
  compressionThreshold?: number;
}

export class OptimizedWebSocket extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private reconnectAttempts: number = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private messageQueue: ArrayBuffer[] = [];
  private isProcessingQueue: boolean = false;
  private lastMessageTime: number = Date.now();
  private connectionPool: Map<string, WebSocket> = new Map();

  constructor(config: WebSocketConfig) {
    super();
    this.config = {
      reconnectAttempts: 5,
      reconnectTimeout: 1000,
      heartbeatInterval: 30000,
      compressionThreshold: 1024, // Compress messages larger than 1KB
      ...config
    };
  }

  public connect(): void {
    try {
      const wsUrl = `${this.config.url}/ws?sessionId=${this.config.sessionId}&deviceId=${this.config.deviceId}&isMain=${this.config.isMain}`;
      this.ws = new WebSocket(wsUrl);
      
      // Set binary type to ArrayBuffer for better performance
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.processMessageQueue();
        this.emit('connected', {
          deviceId: this.config.deviceId,
          isMain: this.config.isMain,
          sessionId: this.config.sessionId
        });
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.stopHeartbeat();
        this.handleReconnect();
        this.emit('disconnected');
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.handleReconnect();
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.config.reconnectAttempts!) {
      this.reconnectAttempts++;
      const timeout = this.config.reconnectTimeout! * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Attempting to reconnect in ${timeout}ms (attempt ${this.reconnectAttempts}/${this.config.reconnectAttempts})`);
      setTimeout(() => this.connect(), timeout);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit('error', new Error('Failed to establish WebSocket connection after multiple attempts'));
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendBinary(new Uint8Array([0])); // Minimal heartbeat message
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private async processMessageQueue(): Promise<void> {
    if (this.isProcessingQueue || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.isProcessingQueue = true;
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        await this.sendBinary(message);
      }
    }
    this.isProcessingQueue = false;
  }

  public sendBinary(data: ArrayBuffer | Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.messageQueue.push(data);
        reject(new Error('WebSocket is not connected'));
        return;
      }

      try {
        // Compress data if it exceeds the threshold
        const compressedData = data.byteLength > this.config.compressionThreshold!
          ? pako.deflate(new Uint8Array(data))
          : data;

        this.ws.send(compressedData);
        this.lastMessageTime = Date.now();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(data: ArrayBuffer): void {
    try {
      // Decompress data if it was compressed
      const decompressedData = pako.inflate(new Uint8Array(data));
      
      // Handle different message types
      if (decompressedData.length === 1 && decompressedData[0] === 0) {
        // Heartbeat message
        return;
      }

      // Process the message
      this.emit('message', decompressedData);
    } catch (error) {
      console.error('Error handling message:', error);
      this.emit('error', error);
    }
  }

  public close(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.messageQueue = [];
    this.isProcessingQueue = false;
  }

  public getConnectionState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  public getLastMessageTime(): number {
    return this.lastMessageTime;
  }
} 
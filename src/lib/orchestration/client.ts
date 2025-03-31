import { EventEmitter } from 'events';

export interface TranslationOrchestrationConfig {
  isMain: boolean;
  sessionId: string;
  deviceId?: string;
  audioContext?: AudioContext;
}

export class TranslationOrchestrationClient extends EventEmitter {
  private isMain: boolean;
  private sessionId: string;
  private deviceId: string;
  private audioContext: AudioContext | null = null;
  private isConnected: boolean = false;
  private ws: WebSocket | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: number = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(config: TranslationOrchestrationConfig) {
    super();
    this.isMain = config.isMain;
    this.sessionId = config.sessionId;
    this.deviceId = config.deviceId || `device-${Math.random().toString(36).substr(2, 9)}`;
    this.audioContext = config.audioContext || null;
  }

  private connect(): void {
    try {
      const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'}/ws?sessionId=${this.sessionId}&deviceId=${this.deviceId}&isMain=${this.isMain}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.emit('connected', {
          deviceId: this.deviceId,
          isMain: this.isMain,
          sessionId: this.sessionId
        });
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnected = false;
        this.stopHeartbeat();
        this.handleReconnect();
        this.emit('disconnected');
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.handleReconnect();
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const timeout = this.reconnectTimeout * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Attempting to reconnect in ${timeout}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => this.connect(), timeout);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit('error', new Error('Failed to establish WebSocket connection after multiple attempts'));
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private handleMessage(data: any): void {
    switch (data.type) {
      case 'translation':
        this.emit('translationReceived', data.payload);
        break;
      case 'error':
        this.emit('error', new Error(data.message));
        break;
      case 'heartbeat':
        // Handle heartbeat response if needed
        break;
      default:
        console.warn('Unknown message type:', data.type);
    }
  }

  async start(): Promise<void> {
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }
      this.connect();
    } catch (error) {
      console.error('Failed to start TranslationOrchestrationClient:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.stopHeartbeat();
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      this.isConnected = false;
      if (this.audioContext) {
        await this.audioContext.close();
        this.audioContext = null;
      }
      this.emit('disconnected');
      console.log('TranslationOrchestrationClient stopped');
    } catch (error) {
      console.error('Failed to stop TranslationOrchestrationClient:', error);
      throw error;
    }
  }

  async sendTranslation(audioData: Float32Array): Promise<void> {
    if (!this.isMain) {
      throw new Error('Only main device can send translations');
    }
    if (!this.isConnected || !this.ws) {
      throw new Error('Client is not connected');
    }

    try {
      this.ws.send(JSON.stringify({
        type: 'translation',
        payload: {
          timestamp: Date.now(),
          data: Array.from(audioData)
        }
      }));
    } catch (error) {
      console.error('Error sending translation:', error);
      throw error;
    }
  }

  async receiveTranslation(): Promise<Float32Array> {
    if (this.isMain) {
      throw new Error('Main device cannot receive translations');
    }
    if (!this.isConnected) {
      throw new Error('Client is not connected');
    }

    // Here we would implement the actual translation receiving logic
    // For now, return an empty array
    return new Float32Array();
  }

  // Helper methods for audio context management
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  isMainDevice(): boolean {
    return this.isMain;
  }

  getDeviceId(): string {
    return this.deviceId;
  }

  getSessionId(): string {
    return this.sessionId;
  }
} 
import { EventEmitter } from 'events';

interface SignalingConfig {
  url: string;
  sessionId: string;
  deviceId: string;
  isMain: boolean;
  reconnectAttempts?: number;
  reconnectTimeout?: number;
}

export class WebRTCSignaling extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: SignalingConfig;
  private reconnectAttempts: number = 0;
  private isConnected: boolean = false;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];

  constructor(config: SignalingConfig) {
    super();
    this.config = {
      reconnectAttempts: 5,
      reconnectTimeout: 1000,
      ...config
    };
  }

  public connect(): void {
    try {
      if (this.ws) {
        console.log('Closing existing WebSocket connection');
        this.ws.close();
        this.ws = null;
      }

      const wsUrl = `${this.config.url}/webrtc?sessionId=${this.config.sessionId}&deviceId=${this.config.deviceId}&isMain=${this.config.isMain}`;
      console.log('Connecting to WebSocket server:', wsUrl);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('Signaling server connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
        this.sendPendingIceCandidates();
      };

      this.ws.onclose = (event) => {
        console.log('Signaling server disconnected:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        this.isConnected = false;
        this.handleReconnect();
        this.emit('disconnected');
      };

      this.ws.onerror = (error) => {
        console.error('Signaling server error:', error);
        this.emit('error', error);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received signaling message:', {
            type: data.type,
            from: data.from,
            dataSize: event.data.length
          });
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing signaling message:', error);
        }
      };
    } catch (error) {
      console.error('Error connecting to signaling server:', error);
      this.handleReconnect();
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.config.reconnectAttempts!) {
      this.reconnectAttempts++;
      const timeout = this.config.reconnectTimeout! * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Attempting to reconnect in ${timeout}ms (attempt ${this.reconnectAttempts}/${this.config.reconnectAttempts})`);
      setTimeout(() => {
        if (!this.isConnected) {
          this.connect();
        }
      }, timeout);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit('error', new Error('Failed to establish signaling connection after multiple attempts'));
    }
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case 'offer':
        this.emit('offer', message.offer, message.from);
        break;
      case 'answer':
        this.emit('answer', message.answer, message.from);
        break;
      case 'ice-candidate':
        const candidate = {
          ...message.candidate,
          sdpMid: message.candidate.sdpMid || '0',
          sdpMLineIndex: message.candidate.sdpMLineIndex || 0
        };
        this.emit('iceCandidate', candidate, message.from);
        break;
      case 'error':
        this.emit('error', new Error(message.error));
        break;
      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  public sendOffer(offer: RTCSessionDescriptionInit): void {
    if (!this.isConnected) {
      throw new Error('Not connected to signaling server');
    }

    this.ws?.send(JSON.stringify({
      type: 'offer',
      offer
    }));
  }

  public sendAnswer(answer: RTCSessionDescriptionInit): void {
    if (!this.isConnected) {
      throw new Error('Not connected to signaling server');
    }

    this.ws?.send(JSON.stringify({
      type: 'answer',
      answer
    }));
  }

  public sendIceCandidate(candidate: RTCIceCandidateInit): void {
    if (!this.isConnected) {
      this.pendingIceCandidates.push(candidate);
      return;
    }

    this.ws?.send(JSON.stringify({
      type: 'ice-candidate',
      candidate
    }));
  }

  public sendPendingIceCandidates(): void {
    if (!this.isConnected) {
      return;
    }

    while (this.pendingIceCandidates.length > 0) {
      const candidate = this.pendingIceCandidates.shift();
      if (candidate) {
        this.sendIceCandidate(candidate);
      }
    }
  }

  public close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.pendingIceCandidates = [];
  }

  public isSignalingConnected(): boolean {
    return this.isConnected;
  }
} 
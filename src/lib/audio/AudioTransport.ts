import { EventEmitter } from 'events';
import { OptimizedWebSocket } from '../websocket/OptimizedWebSocket.js';
import { AudioStreamer } from '../webrtc/AudioStreamer.js';

export interface AudioTransportConfig {
  sessionId: string;
  deviceId: string;
  isMain: boolean;
  transportType: 'websocket' | 'webrtc' | 'auto';
  websocketUrl?: string;
  iceServers?: RTCIceServer[];
  maxBitrate?: number;
  qualityThreshold?: number;
}

export class AudioTransport extends EventEmitter {
  private ws: OptimizedWebSocket | null = null;
  private webrtc: AudioStreamer | null = null;
  private config: AudioTransportConfig;
  private isInitialized: boolean = false;
  private currentTransportType: 'websocket' | 'webrtc' = 'websocket';

  constructor(config: AudioTransportConfig) {
    super();
    const { transportType, ...restConfig } = config;
    this.config = {
      transportType: 'auto',
      ...restConfig
    };
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Determine transport type
      if (this.config.transportType === 'auto') {
        this.currentTransportType = await this.determineOptimalTransport();
      } else {
        this.currentTransportType = this.config.transportType;
      }

      // Initialize selected transport
      if (this.currentTransportType === 'websocket') {
        await this.initializeWebSocket();
      } else {
        await this.initializeWebRTC();
      }

      this.isInitialized = true;
      this.emit('initialized', { transportType: this.currentTransportType });
    } catch (error) {
      console.error('Error initializing audio transport:', error);
      this.emit('error', error);
      throw error;
    }
  }

  private async determineOptimalTransport(): Promise<'websocket' | 'webrtc'> {
    // Check WebRTC support
    const hasWebRTC = !!(
      window.RTCPeerConnection ||
      (window as any).webkitRTCPeerConnection ||
      (window as any).mozRTCPeerConnection
    );

    // Check network conditions
    const connection = (navigator as any).connection;
    if (connection) {
      const { effectiveType, rtt, downlink } = connection;
      
      // If we have good network conditions and WebRTC support, use WebRTC
      if (hasWebRTC && effectiveType !== '2g' && rtt < 100 && downlink > 1) {
        return 'webrtc';
      }
    }

    // Default to WebSocket if conditions aren't optimal for WebRTC
    return 'websocket';
  }

  private async initializeWebSocket(): Promise<void> {
    if (!this.config.websocketUrl) {
      throw new Error('WebSocket URL is required');
    }

    this.ws = new OptimizedWebSocket({
      url: this.config.websocketUrl,
      sessionId: this.config.sessionId,
      deviceId: this.config.deviceId,
      isMain: this.config.isMain
    });

    this.ws.on('connected', () => {
      this.emit('connected');
    });

    this.ws.on('disconnected', () => {
      this.emit('disconnected');
    });

    this.ws.on('message', (data) => {
      this.emit('audioData', data);
    });

    this.ws.on('error', (error) => {
      this.emit('error', error);
    });

    this.ws.connect();
  }

  private async initializeWebRTC(): Promise<void> {
    this.webrtc = new AudioStreamer({
      sessionId: this.config.sessionId,
      deviceId: this.config.deviceId,
      isMain: this.config.isMain,
      iceServers: this.config.iceServers,
      maxBitrate: this.config.maxBitrate,
      qualityThreshold: this.config.qualityThreshold
    });

    this.webrtc.on('initialized', () => {
      this.emit('connected');
    });

    this.webrtc.on('remoteStream', (stream) => {
      this.emit('remoteStream', stream);
    });

    this.webrtc.on('error', (error) => {
      this.emit('error', error);
    });

    await this.webrtc.initialize();
  }

  public async sendAudioData(data: ArrayBuffer | Uint8Array): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Audio transport not initialized');
    }

    if (this.currentTransportType === 'websocket' && this.ws) {
      await this.ws.sendBinary(data);
    } else if (this.currentTransportType === 'webrtc' && this.webrtc) {
      // WebRTC handles audio data through the MediaStream directly
      // No need to send raw audio data
      console.warn('Attempted to send audio data through WebRTC transport');
    }
  }

  public async createOffer(): Promise<RTCSessionDescriptionInit | null> {
    if (this.currentTransportType === 'webrtc' && this.webrtc) {
      return await this.webrtc.createOffer();
    }
    return null;
  }

  public async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (this.currentTransportType === 'webrtc' && this.webrtc) {
      await this.webrtc.handleAnswer(answer);
    }
  }

  public async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (this.currentTransportType === 'webrtc' && this.webrtc) {
      await this.webrtc.handleIceCandidate(candidate);
    }
  }

  public startStreaming(): void {
    if (this.currentTransportType === 'webrtc' && this.webrtc) {
      this.webrtc.startStreaming();
    }
  }

  public stopStreaming(): void {
    if (this.currentTransportType === 'webrtc' && this.webrtc) {
      this.webrtc.stopStreaming();
    }
  }

  public cleanup(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.webrtc) {
      this.webrtc.cleanup();
      this.webrtc = null;
    }
    this.isInitialized = false;
  }

  public getTransportType(): 'websocket' | 'webrtc' {
    return this.currentTransportType;
  }
} 
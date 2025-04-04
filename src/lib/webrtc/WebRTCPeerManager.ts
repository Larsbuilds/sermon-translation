import { EventEmitter } from 'events';
import { WebRTCSignaling } from './WebRTCSignaling.js';

interface PeerConfig {
  signalingUrl: string;
  sessionId: string;
  deviceId: string;
  isMain: boolean;
  iceServers?: RTCIceServer[];
  audioConstraints?: MediaTrackConstraints;
}

export class WebRTCPeerManager extends EventEmitter {
  private signaling: WebRTCSignaling;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private config: PeerConfig;
  private isConnecting: boolean = false;

  constructor(config: PeerConfig) {
    super();
    this.config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ],
      audioConstraints: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      ...config
    };

    this.signaling = new WebRTCSignaling({
      url: config.signalingUrl,
      sessionId: config.sessionId,
      deviceId: config.deviceId,
      isMain: config.isMain
    });

    this.setupSignalingHandlers();
  }

  private setupSignalingHandlers(): void {
    this.signaling.on('connected', () => {
      console.log('Signaling connected, initializing WebRTC');
      this.initializePeerConnection();
    });

    this.signaling.on('offer', async (offer: RTCSessionDescriptionInit) => {
      if (this.peerConnection) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        this.signaling.sendAnswer(answer);
      }
    });

    this.signaling.on('answer', async (answer: RTCSessionDescriptionInit) => {
      if (this.peerConnection) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    this.signaling.on('iceCandidate', async (candidate: RTCIceCandidateInit) => {
      if (this.peerConnection) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    this.signaling.on('error', (error: Error) => {
      this.emit('error', error);
    });
  }

  private async initializePeerConnection(): Promise<void> {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      // Create peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: this.config.iceServers
      });

      // Setup event handlers
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.signaling.sendIceCandidate(event.candidate);
        }
      };

      this.peerConnection.ontrack = (event) => {
        this.remoteStream = event.streams[0];
        this.emit('remoteStream', this.remoteStream);
      };

      this.peerConnection.onconnectionstatechange = () => {
        this.emit('connectionStateChange', this.peerConnection?.connectionState);
      };

      // Get local media stream
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: this.config.audioConstraints
      });

      // Add tracks to peer connection
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      // Create and send offer if main peer
      if (this.config.isMain) {
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        this.signaling.sendOffer(offer);
      }

      this.isConnecting = false;
      this.emit('connected');
    } catch (error) {
      this.isConnecting = false;
      this.emit('error', error instanceof Error ? error : new Error('Failed to initialize peer connection'));
    }
  }

  public async start(): Promise<void> {
    this.signaling.connect();
  }

  public async stop(): Promise<void> {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.signaling.close();
    this.emit('disconnected');
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  public getConnectionState(): RTCPeerConnectionState | undefined {
    return this.peerConnection?.connectionState;
  }

  public async setAudioEnabled(enabled: boolean): Promise<void> {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = enabled;
      }
    }
  }

  public async setMuted(muted: boolean): Promise<void> {
    await this.setAudioEnabled(!muted);
  }
} 
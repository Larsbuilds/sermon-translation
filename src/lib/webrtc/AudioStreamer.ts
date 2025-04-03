import { EventEmitter } from 'events';

interface WebRTCConfig {
  sessionId: string;
  deviceId: string;
  isMain: boolean;
  iceServers?: RTCIceServer[];
  audioConstraints?: MediaTrackConstraints;
  maxBitrate?: number;
  qualityThreshold?: number;
}

export class AudioStreamer extends EventEmitter {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private config: WebRTCConfig;
  private audioContext: AudioContext | null = null;
  private analyzer: AnalyserNode | null = null;
  private qualityCheckInterval: NodeJS.Timeout | null = null;
  private isStreaming: boolean = false;

  constructor(config: WebRTCConfig) {
    super();
    this.config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ],
      maxBitrate: 128000, // 128 kbps
      qualityThreshold: 0.7,
      ...config
    };
  }

  public async initialize(): Promise<void> {
    try {
      // Create audio context
      this.audioContext = new AudioContext({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });

      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: this.config.audioConstraints || {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Create analyzer
      const source = this.audioContext.createMediaStreamSource(this.localStream);
      this.analyzer = this.audioContext.createAnalyser();
      this.analyzer.fftSize = 2048;
      source.connect(this.analyzer);

      // Create peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: this.config.iceServers
      });

      // Add local stream tracks to peer connection
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection) {
          this.peerConnection.addTrack(track, this.localStream!);
        }
      });

      // Handle incoming tracks
      this.peerConnection.ontrack = (event) => {
        this.remoteStream = event.streams[0];
        this.emit('remoteStream', this.remoteStream);
      };

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.emit('iceCandidate', event.candidate);
        }
      };

      // Handle connection state changes
      this.peerConnection.onconnectionstatechange = () => {
        this.emit('connectionStateChange', this.peerConnection?.connectionState);
      };

      // Start quality monitoring
      this.startQualityMonitoring();

      this.emit('initialized');
    } catch (error) {
      console.error('Error initializing WebRTC:', error);
      this.emit('error', error);
      throw error;
    }
  }

  private startQualityMonitoring(): void {
    if (!this.analyzer) return;

    const bufferLength = this.analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    this.qualityCheckInterval = setInterval(() => {
      this.analyzer?.getByteFrequencyData(dataArray);
      const quality = this.calculateAudioQuality(dataArray);
      
      if (quality < this.config.qualityThreshold!) {
        this.emit('qualityWarning', quality);
        this.adjustQuality();
      }
    }, 1000);
  }

  private calculateAudioQuality(dataArray: Uint8Array): number {
    // Calculate signal-to-noise ratio
    let signalSum = 0;
    let noiseSum = 0;
    const threshold = 128; // Midpoint of 8-bit audio

    for (let i = 0; i < dataArray.length; i++) {
      if (dataArray[i] > threshold) {
        signalSum += dataArray[i];
      } else {
        noiseSum += dataArray[i];
      }
    }

    const signalAvg = signalSum / (dataArray.length / 2);
    const noiseAvg = noiseSum / (dataArray.length / 2);
    return signalAvg / (noiseAvg + 1); // Add 1 to avoid division by zero
  }

  private adjustQuality(): void {
    if (!this.localStream) return;

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (!audioTrack) return;

    // Adjust bitrate
    const sender = this.peerConnection?.getSenders().find(s => s.track?.kind === 'audio');
    if (sender) {
      const parameters = sender.getParameters();
      if (!parameters.encodings) {
        parameters.encodings = [{}];
      }
      parameters.encodings[0].maxBitrate = this.config.maxBitrate;
      sender.setParameters(parameters).catch(console.error);
    }
  }

  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true
    });
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  public async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    await this.peerConnection.setRemoteDescription(answer);
  }

  public async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    await this.peerConnection.addIceCandidate(candidate);
  }

  public startStreaming(): void {
    if (!this.localStream) {
      throw new Error('Local stream not initialized');
    }
    this.isStreaming = true;
    this.emit('streamingStarted');
  }

  public stopStreaming(): void {
    this.isStreaming = false;
    if (this.qualityCheckInterval) {
      clearInterval(this.qualityCheckInterval);
      this.qualityCheckInterval = null;
    }
    this.emit('streamingStopped');
  }

  public cleanup(): void {
    this.stopStreaming();
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyzer = null;
    this.remoteStream = null;
  }
} 
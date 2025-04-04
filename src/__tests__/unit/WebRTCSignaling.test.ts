import { WebRTCSignaling } from '../../lib/webrtc/WebRTCSignaling';
import { EventEmitter } from 'events';

// Mock WebSocket
class MockWebSocket {
  onopen: (() => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  readyState = 1;
  
  constructor(url: string) {
    // Simulate connection
    setTimeout(() => this.onopen?.(), 0);
  }

  send(data: string) {
    // Mock send
  }

  close() {
    this.onclose?.({ code: 1000, reason: 'Normal closure', wasClean: true });
  }
}

// Mock global WebSocket
global.WebSocket = MockWebSocket as any;

describe('WebRTCSignaling', () => {
  let signaling: WebRTCSignaling;
  const config = {
    url: 'ws://localhost:3002',
    sessionId: 'test-session',
    deviceId: 'test-device',
    isMain: true
  };

  beforeEach(() => {
    signaling = new WebRTCSignaling(config);
  });

  afterEach(() => {
    signaling.close();
  });

  test('should connect to WebSocket server', (done) => {
    signaling.on('connected', () => {
      expect(signaling.isSignalingConnected()).toBe(true);
      done();
    });
    signaling.connect();
  });

  test('should handle connection close', (done) => {
    signaling.on('disconnected', () => {
      expect(signaling.isSignalingConnected()).toBe(false);
      done();
    });
    signaling.connect();
    setTimeout(() => signaling.close(), 100);
  });

  test('should send offer', () => {
    const offer = { type: 'offer', sdp: 'test-sdp' };
    signaling.connect();
    signaling.sendOffer(offer);
    // Add assertions for offer sending
  });

  test('should send answer', () => {
    const answer = { type: 'answer', sdp: 'test-sdp' };
    signaling.connect();
    signaling.sendAnswer(answer);
    // Add assertions for answer sending
  });

  test('should send ICE candidate', () => {
    const candidate = {
      candidate: 'test-candidate',
      sdpMid: 'test-mid',
      sdpMLineIndex: 0
    };
    signaling.connect();
    signaling.sendIceCandidate(candidate);
    // Add assertions for ICE candidate sending
  });

  test('should queue ICE candidates when not connected', () => {
    const candidate = {
      candidate: 'test-candidate',
      sdpMid: 'test-mid',
      sdpMLineIndex: 0
    };
    signaling.sendIceCandidate(candidate);
    expect(signaling.isSignalingConnected()).toBe(false);
    // Add assertions for queued candidates
  });

  test('should handle reconnection', (done) => {
    let connectionCount = 0;
    signaling.on('connected', () => {
      connectionCount++;
      if (connectionCount === 2) {
        expect(signaling.isSignalingConnected()).toBe(true);
        done();
      }
    });
    signaling.connect();
    setTimeout(() => {
      (signaling as any).ws?.onclose?.({ code: 1006, reason: 'Connection lost', wasClean: false });
    }, 100);
  });
}); 
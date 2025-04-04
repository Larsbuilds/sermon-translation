import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { WebRTCSignaling } from '../../lib/webrtc/WebRTCSignaling';
import WebSocket from 'ws';

// Mock WebSocket
class MockWebSocket extends EventTarget {
  public readyState: number;
  public url: string;
  private _closeCode: number;
  private _closeReason: string;
  private _connectTimeout: NodeJS.Timeout | null = null;

  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  constructor(url: string) {
    super();
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this._closeCode = 1000;
    this._closeReason = '';

    // Simulate connection delay
    this._connectTimeout = setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      const openEvent = new Event('open');
      this.dispatchEvent(openEvent);
      this._connectTimeout = null;
    }, 50);
  }

  send(data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    // Echo back the message for testing
    const messageEvent = new MessageEvent('message', { data });
    setTimeout(() => this.dispatchEvent(messageEvent), 10);
  }

  close(code?: number, reason?: string): void {
    if (this.readyState === MockWebSocket.CLOSED) {
      return;
    }

    if (this._connectTimeout) {
      clearTimeout(this._connectTimeout);
      this._connectTimeout = null;
    }

    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      this._closeCode = code || 1000;
      this._closeReason = reason || '';
      
      const closeEvent = new Event('close');
      Object.defineProperties(closeEvent, {
        code: { value: this._closeCode },
        reason: { value: this._closeReason },
        wasClean: { value: true }
      });
      this.dispatchEvent(closeEvent);
    }, 50);
  }
}

// Replace global WebSocket with mock
(global as any).WebSocket = MockWebSocket;

describe('WebRTCSignaling', () => {
  let signaling: WebRTCSignaling;

  beforeEach(() => {
    signaling = new WebRTCSignaling({
      url: 'ws://localhost:3002',
      sessionId: 'test-session',
      deviceId: 'test-device',
      isMain: true,
    });
    signaling.removeAllListeners();
  });

  afterEach(() => {
    signaling.close();
  });

  test('should connect to WebSocket server', (done) => {
    signaling.on('connected', () => {
      try {
        expect(signaling.isSignalingConnected()).toBe(true);
        done();
      } catch (error) {
        done(error);
      }
    });
    signaling.connect();
  }, 10000);

  test('should send offer when connected', (done) => {
    const offer: RTCSessionDescriptionInit = {
      type: 'offer',
      sdp: 'test-sdp'
    };
    
    signaling.on('connected', () => {
      try {
        expect(() => signaling.sendOffer(offer)).not.toThrow();
        done();
      } catch (error) {
        done(error);
      }
    });
    signaling.connect();
  }, 10000);

  test('should send answer when connected', (done) => {
    const answer: RTCSessionDescriptionInit = {
      type: 'answer',
      sdp: 'test-sdp'
    };
    
    signaling.on('connected', () => {
      try {
        expect(() => signaling.sendAnswer(answer)).not.toThrow();
        done();
      } catch (error) {
        done(error);
      }
    });
    signaling.connect();
  }, 10000);

  test('should handle reconnection', (done) => {
    let connectionCount = 0;
    
    signaling.on('connected', () => {
      connectionCount++;
      if (connectionCount === 1) {
        // Force disconnect after first connection
        signaling['ws']?.close();
      } else if (connectionCount === 2) {
        try {
          // Verify reconnection successful
          expect(signaling.isSignalingConnected()).toBe(true);
          done();
        } catch (error) {
          done(error);
        }
      }
    });

    signaling.connect();
  }, 15000);
}); 
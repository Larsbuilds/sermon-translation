import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { WebRTCSignaling } from '../../lib/webrtc/WebRTCSignaling';
import WebSocket, { Event as WsEvent, CloseEvent as WsCloseEvent } from 'ws';

// Mock WebSocket
class MockWebSocket extends WebSocket {
  constructor(url: string) {
    super(url);
    // Simulate successful connection after a short delay
    setTimeout(() => {
      if (this.onopen) {
        this.onopen({ type: 'open', target: this } as WsEvent);
      }
    }, 100);
  }

  close(code?: number, reason?: string) {
    if (this.onclose) {
      this.onclose({
        code: code || 1000,
        reason: reason || 'Normal closure',
        wasClean: true,
        type: 'close',
        target: this
      } as WsCloseEvent);
    }
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
    // Clear all event listeners
    signaling.removeAllListeners();
  });

  afterEach(() => {
    signaling.close();
  });

  test('should connect to WebSocket server', async () => {
    await new Promise<void>((resolve) => {
      signaling.on('connected', () => {
        expect(signaling.isSignalingConnected()).toBe(true);
        resolve();
      });
      signaling.connect();
    });
  }, 10000);

  test('should send offer when connected', async () => {
    const offer = { type: 'offer', sdp: 'test-sdp' };
    
    await new Promise<void>((resolve) => {
      signaling.on('connected', () => {
        expect(() => signaling.sendOffer(offer)).not.toThrow();
        resolve();
      });
      signaling.connect();
    });
  }, 10000);

  test('should send answer when connected', async () => {
    const answer = { type: 'answer', sdp: 'test-sdp' };
    
    await new Promise<void>((resolve) => {
      signaling.on('connected', () => {
        expect(() => signaling.sendAnswer(answer)).not.toThrow();
        resolve();
      });
      signaling.connect();
    });
  }, 10000);

  test('should handle reconnection', async () => {
    await new Promise<void>((resolve) => {
      let connectionCount = 0;
      
      signaling.on('connected', () => {
        connectionCount++;
        if (connectionCount === 1) {
          // Force disconnect after first connection
          signaling['ws']?.close();
        } else if (connectionCount === 2) {
          // Verify reconnection successful
          expect(signaling.isSignalingConnected()).toBe(true);
          resolve();
        }
      });

      signaling.connect();
    });
  }, 10000);
}); 
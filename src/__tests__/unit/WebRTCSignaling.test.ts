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
  private _closeTimeout: NodeJS.Timeout | null = null;

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

    if (this._closeTimeout) {
      clearTimeout(this._closeTimeout);
      this._closeTimeout = null;
    }

    this.readyState = MockWebSocket.CLOSING;
    this._closeTimeout = setTimeout(() => {
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
      this._closeTimeout = null;
    }, 50);
  }

  // Helper method for tests to wait for all pending timeouts
  async waitForClose(): Promise<void> {
    if (this._closeTimeout) {
      await new Promise(resolve => {
        const timeout = this._closeTimeout;
        if (timeout) {
          const originalFn = timeout.unref;
          // @ts-ignore
          timeout.unref = () => {
            timeout.unref = originalFn;
            resolve(undefined);
          };
        }
      });
    }
  }
}

// Replace global WebSocket with mock
(global as any).WebSocket = MockWebSocket;

describe('WebRTCSignaling', () => {
  let signaling: WebRTCSignaling;

  beforeEach(() => {
    // Use fake timers for tests
    jest.useFakeTimers();
    
    signaling = new WebRTCSignaling({
      url: 'ws://localhost:3002',
      sessionId: 'test-session',
      deviceId: 'test-device',
      isMain: true,
    });
    signaling.removeAllListeners();
  });

  afterEach(async () => {
    // Clear any pending timers
    jest.clearAllTimers();
    
    // Close signaling connection
    signaling.close();
    
    // Wait for cleanup
    if (signaling['ws']) {
      await ((signaling['ws'] as unknown) as MockWebSocket).waitForClose();
    }
    
    // Remove all listeners
    signaling.removeAllListeners();
    
    // Reset mock timers
    jest.useRealTimers();
  });

  test('should connect to WebSocket server', (done) => {
    const cleanup = async () => {
      // Clear any pending timers
      jest.clearAllTimers();
      
      signaling.close();
      if (signaling['ws']) {
        await ((signaling['ws'] as unknown) as MockWebSocket).waitForClose();
      }
      signaling.removeAllListeners();
      done();
    };

    signaling.on('connected', async () => {
      try {
        expect(signaling.isSignalingConnected()).toBe(true);
        await cleanup();
      } catch (error) {
        await cleanup();
        done(error instanceof Error ? error : new Error(String(error)));
      }
    });
    signaling.connect();
    jest.runAllTimers();
  }, 10000);

  test('should send offer when connected', (done) => {
    const offer: RTCSessionDescriptionInit = {
      type: 'offer',
      sdp: 'test-sdp'
    };
    
    const cleanup = async () => {
      // Clear any pending timers
      jest.clearAllTimers();
      
      signaling.close();
      if (signaling['ws']) {
        await ((signaling['ws'] as unknown) as MockWebSocket).waitForClose();
      }
      signaling.removeAllListeners();
      done();
    };

    signaling.on('connected', async () => {
      try {
        expect(() => signaling.sendOffer(offer)).not.toThrow();
        await cleanup();
      } catch (error) {
        await cleanup();
        done(error instanceof Error ? error : new Error(String(error)));
      }
    });
    signaling.connect();
    jest.runAllTimers();
  }, 10000);

  test('should send answer when connected', (done) => {
    const answer: RTCSessionDescriptionInit = {
      type: 'answer',
      sdp: 'test-sdp'
    };
    
    const cleanup = async () => {
      // Clear any pending timers
      jest.clearAllTimers();
      
      signaling.close();
      if (signaling['ws']) {
        await ((signaling['ws'] as unknown) as MockWebSocket).waitForClose();
      }
      signaling.removeAllListeners();
      done();
    };

    signaling.on('connected', async () => {
      try {
        expect(() => signaling.sendAnswer(answer)).not.toThrow();
        await cleanup();
      } catch (error) {
        await cleanup();
        done(error instanceof Error ? error : new Error(String(error)));
      }
    });
    signaling.connect();
    jest.runAllTimers();
  }, 10000);

  test('should handle reconnection', async () => {
    let connectionCount = 0;
    
    const waitForConnection = new Promise<void>((resolve) => {
      signaling.on('connected', () => {
        connectionCount++;
        if (connectionCount === 2) {
          resolve();
        }
      });
    });

    signaling.connect();
    jest.runAllTimers();
    
    // Force disconnect
    if (signaling['ws']) {
      ((signaling['ws'] as unknown) as MockWebSocket).close();
    }
    jest.runAllTimers();

    await waitForConnection;
    expect(connectionCount).toBe(2);
    
    // Cleanup
    signaling.close();
    if (signaling['ws']) {
      await ((signaling['ws'] as unknown) as MockWebSocket).waitForClose();
    }
    signaling.removeAllListeners();
  }, 30000);
}); 
import { useState, useEffect, useCallback, useRef } from 'react';
import { WebRTCPeerManager } from './WebRTCPeerManager.ts';

interface UseWebRTCConfig {
  signalingUrl: string;
  sessionId: string;
  deviceId: string;
  isMain: boolean;
  iceServers?: RTCIceServer[];
  audioConstraints?: MediaTrackConstraints;
}

interface UseWebRTCState {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: RTCPeerConnectionState | undefined;
  isMuted: boolean;
}

export function useWebRTC(config: UseWebRTCConfig) {
  const peerManager = useRef<WebRTCPeerManager | null>(null);
  const [state, setState] = useState<UseWebRTCState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    localStream: null,
    remoteStream: null,
    connectionState: undefined,
    isMuted: false
  });

  useEffect(() => {
    const manager = new WebRTCPeerManager(config);

    manager.on('connected', () => {
      setState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        localStream: manager.getLocalStream(),
        remoteStream: manager.getRemoteStream(),
        connectionState: manager.getConnectionState()
      }));
    });

    manager.on('disconnected', () => {
      setState(prev => ({
        ...prev,
        isConnected: false,
        localStream: null,
        remoteStream: null,
        connectionState: undefined
      }));
    });

    manager.on('remoteStream', (stream: MediaStream) => {
      setState(prev => ({
        ...prev,
        remoteStream: stream
      }));
    });

    manager.on('connectionStateChange', (connectionState: RTCPeerConnectionState) => {
      setState(prev => ({
        ...prev,
        connectionState
      }));
    });

    manager.on('error', (error: Error) => {
      setState(prev => ({
        ...prev,
        error,
        isConnecting: false
      }));
    });

    peerManager.current = manager;

    return () => {
      manager.stop();
    };
  }, [config.signalingUrl, config.sessionId, config.deviceId, config.isMain]);

  const start = useCallback(async () => {
    if (!peerManager.current) return;

    setState(prev => ({ ...prev, isConnecting: true, error: null }));
    try {
      await peerManager.current.start();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error : new Error('Failed to start WebRTC connection'),
        isConnecting: false
      }));
    }
  }, []);

  const stop = useCallback(async () => {
    if (!peerManager.current) return;
    await peerManager.current.stop();
  }, []);

  const setMuted = useCallback(async (muted: boolean) => {
    if (!peerManager.current) return;
    await peerManager.current.setMuted(muted);
    setState(prev => ({ ...prev, isMuted: muted }));
  }, []);

  return {
    ...state,
    start,
    stop,
    setMuted
  };
} 
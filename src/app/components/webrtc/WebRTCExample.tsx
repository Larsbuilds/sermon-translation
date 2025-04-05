import React, { useEffect } from 'react';
import { useWebRTC } from '@/lib/webrtc/useWebRTC.js';

interface WebRTCExampleProps {
  sessionId: string;
  deviceId: string;
  isMain: boolean;
  signalingUrl: string;
}

export function WebRTCExample({ sessionId, deviceId, isMain, signalingUrl }: WebRTCExampleProps) {
  const {
    isConnected,
    isConnecting,
    error,
    localStream,
    remoteStream,
    connectionState,
    isMuted,
    start,
    stop,
    setMuted
  } = useWebRTC({
    signalingUrl,
    sessionId,
    deviceId,
    isMain
  });

  useEffect(() => {
    start();
    return () => {
      stop();
    };
  }, [start, stop]);

  return (
    <div className="p-4 border rounded-lg shadow-sm">
      <h2 className="text-xl font-semibold mb-4">WebRTC Connection Status</h2>
      
      <div className="space-y-4">
        <div>
          <p className="font-medium">Connection Status:</p>
          <p className={`inline-block px-2 py-1 rounded ${
            isConnected ? 'bg-green-100 text-green-800' :
            isConnecting ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
          </p>
        </div>

        {connectionState && (
          <div>
            <p className="font-medium">WebRTC State:</p>
            <p className="inline-block px-2 py-1 rounded bg-gray-100">
              {connectionState}
            </p>
          </div>
        )}

        {error && (
          <div>
            <p className="font-medium text-red-600">Error:</p>
            <p className="text-red-600">{error.message}</p>
          </div>
        )}

        <div className="flex items-center space-x-4">
          <button
            onClick={() => setMuted(!isMuted)}
            className={`px-4 py-2 rounded ${
              isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
            } text-white`}
          >
            {isMuted ? 'Unmute' : 'Mute'}
          </button>

          <button
            onClick={stop}
            className="px-4 py-2 rounded bg-gray-500 hover:bg-gray-600 text-white"
          >
            Stop Connection
          </button>
        </div>

        {localStream && (
          <div>
            <p className="font-medium">Local Audio:</p>
            <audio
              ref={(el) => {
                if (el) {
                  el.srcObject = localStream;
                }
              }}
              autoPlay
              muted
              className="w-full"
            />
          </div>
        )}

        {remoteStream && (
          <div>
            <p className="font-medium">Remote Audio:</p>
            <audio
              ref={(el) => {
                if (el) {
                  el.srcObject = remoteStream;
                }
              }}
              autoPlay
              className="w-full"
            />
          </div>
        )}
      </div>
    </div>
  );
} 
'use client';

import React, { useState } from 'react';
import { WebRTCExample } from '@/app/components/webrtc/WebRTCExample.tsx';

export default function WebRTCPage() {
  const [sessionId] = useState(() => `session-${Math.random().toString(36).substring(7)}`);
  const [deviceId] = useState(() => `device-${Math.random().toString(36).substring(7)}`);
  const [isMain] = useState(() => Math.random() > 0.5);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">WebRTC Audio Streaming Demo</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Connection Details</h2>
        <div className="space-y-2">
          <p><span className="font-medium">Session ID:</span> {sessionId}</p>
          <p><span className="font-medium">Device ID:</span> {deviceId}</p>
          <p><span className="font-medium">Role:</span> {isMain ? 'Main (Initiator)' : 'Secondary (Receiver)'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">Instance 1</h2>
          <WebRTCExample
            sessionId={sessionId}
            deviceId={`${deviceId}-1`}
            isMain={isMain}
            signalingUrl={process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:3002'}
          />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Instance 2</h2>
          <WebRTCExample
            sessionId={sessionId}
            deviceId={`${deviceId}-2`}
            isMain={!isMain}
            signalingUrl={process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:3002'}
          />
        </div>
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Instructions</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>Open this page in two different browser windows or tabs</li>
          <li>Allow microphone access when prompted</li>
          <li>One instance will automatically initiate the connection (Main)</li>
          <li>The other instance will automatically accept the connection (Secondary)</li>
          <li>Use the Mute/Unmute buttons to control audio</li>
          <li>Use the Stop Connection button to end the connection</li>
        </ol>
      </div>
    </div>
  );
} 
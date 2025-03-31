'use client';

import React, { useEffect, useState } from 'react';
import { TranslationOrchestrationClient } from '../../../lib/orchestration/client';

interface DeviceManagerProps {
  isMain: boolean;
  sessionId: string;
  onConnected?: (client: TranslationOrchestrationClient) => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
}

export default function DeviceManager({
  isMain,
  sessionId,
  onConnected,
  onDisconnected,
  onError
}: DeviceManagerProps): JSX.Element {
  const [client, setClient] = useState<TranslationOrchestrationClient | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const initializeClient = async () => {
      try {
        setIsConnecting(true);
        const newClient = new TranslationOrchestrationClient({
          isMain,
          sessionId
        });

        // Set up event listeners
        newClient.on('connected', () => {
          setClient(newClient);
          onConnected?.(newClient);
        });

        newClient.on('disconnected', () => {
          setClient(null);
          onDisconnected?.();
        });

        // Start the client
        await newClient.start();
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Failed to initialize device'));
      } finally {
        setIsConnecting(false);
      }
    };

    initializeClient();

    // Cleanup function
    return () => {
      if (client) {
        client.stop().catch(error => {
          console.error('Error stopping client:', error);
        });
      }
    };
  }, [isMain, sessionId]);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {isMain ? 'Main Device' : 'Listener Device'}
          </h2>
          <p className="text-sm text-gray-600">
            Session ID: {sessionId}
          </p>
        </div>
        <div className="flex items-center">
          <div
            className={`w-3 h-3 rounded-full mr-2 ${
              isConnecting
                ? 'bg-yellow-500 animate-pulse'
                : client
                ? 'bg-green-500'
                : 'bg-red-500'
            }`}
          />
          <span className="text-sm">
            {isConnecting
              ? 'Connecting...'
              : client
              ? 'Connected'
              : 'Disconnected'}
          </span>
        </div>
      </div>
    </div>
  );
} 
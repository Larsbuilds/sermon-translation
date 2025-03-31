'use client';

import React, { useEffect, useState, useCallback } from 'react';
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
  const [isConnected, setIsConnected] = useState(false);
  const [client, setClient] = useState<TranslationOrchestrationClient | null>(null);

  const handleConnect = useCallback(async () => {
    try {
      const newClient = new TranslationOrchestrationClient({
        deviceId: `device-${Math.random().toString(36).substr(2, 9)}`,
        isMainDevice: isMain,
        sessionId
      });

      await newClient.start();
      setClient(newClient);
      setIsConnected(true);
      onConnected?.(newClient);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Failed to connect device'));
    }
  }, [isMain, sessionId, onConnected, onError]);

  const handleDisconnect = useCallback(async () => {
    try {
      if (client) {
        await client.stop();
        setClient(null);
        setIsConnected(false);
        onDisconnected?.();
      }
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Failed to disconnect device'));
    }
  }, [client, onDisconnected, onError]);

  useEffect(() => {
    if (client) {
      const handleConnected = () => {
        setIsConnected(true);
        onConnected?.(client);
      };

      const handleDisconnected = () => {
        setIsConnected(false);
        onDisconnected?.();
      };

      const handleError = (error: Error) => {
        onError?.(error);
      };

      client.on('connected', handleConnected);
      client.on('disconnected', handleDisconnected);
      client.on('error', handleError);

      return () => {
        client.off('connected', handleConnected);
        client.off('disconnected', handleDisconnected);
        client.off('error', handleError);
      };
    }
  }, [client, onConnected, onDisconnected, onError]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">
            {isMain ? 'Main Device (Speaker)' : 'Listener Device'}
          </h3>
          <p className="text-sm text-gray-600">Session ID: {sessionId}</p>
        </div>
        <button
          onClick={isConnected ? handleDisconnect : handleConnect}
          className={`px-4 py-2 rounded-lg font-medium text-white transition-all duration-200 ${
            isConnected
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-green-500 hover:bg-green-600'
          }`}
        >
          {isConnected ? 'Disconnect' : 'Connect'}
        </button>
      </div>
      
      <div className="flex items-center space-x-2">
        <div
          className={`w-3 h-3 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-gray-400'
          }`}
        />
        <span className="text-sm text-gray-600">
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
    </div>
  );
} 
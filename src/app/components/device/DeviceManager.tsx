'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { TranslationOrchestrationClient } from '@/lib/orchestration/client';
import { toast } from 'sonner';

interface DeviceManagerProps {
  isMain: boolean;
  sessionId: string;
  onConnected?: (client: TranslationOrchestrationClient) => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
}

interface AudioDevice {
  deviceId: string;
  label: string;
  kind: string;
}

export default function DeviceManager({
  isMain,
  sessionId,
  onConnected,
  onDisconnected,
  onError
}: DeviceManagerProps): React.ReactElement {
  const [isConnected, setIsConnected] = useState(false);
  const [client, setClient] = useState<TranslationOrchestrationClient | null>(null);
  const [availableDevices, setAvailableDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const getAvailableDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = devices.filter(device => device.kind === 'audioinput');
      setAvailableDevices(audioDevices);
      
      // Set default device if available
      if (audioDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(audioDevices[0].deviceId);
      }
    } catch (error) {
      console.error('Error getting audio devices:', error);
      toast.error('Failed to get audio devices');
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    getAvailableDevices();
    
    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', getAvailableDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getAvailableDevices);
    };
  }, [getAvailableDevices]);

  const handleConnect = useCallback(async () => {
    try {
      setIsLoading(true);
      const newClient = new TranslationOrchestrationClient({
        deviceId: `device-${Math.random().toString(36).substr(2, 9)}`,
        isMain,
        sessionId
      });

      await newClient.start();
      setClient(newClient);
      setIsConnected(true);
      onConnected?.(newClient);
      toast.success('Device connected successfully');
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to connect device');
      onError?.(err);
      toast.error('Failed to connect device');
    } finally {
      setIsLoading(false);
    }
  }, [isMain, sessionId, onConnected, onError]);

  const handleDisconnect = useCallback(async () => {
    try {
      if (client) {
        await client.stop();
        setClient(null);
        setIsConnected(false);
        onDisconnected?.();
        toast.success('Device disconnected successfully');
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to disconnect device');
      onError?.(err);
      toast.error('Failed to disconnect device');
    }
  }, [client, onDisconnected, onError]);

  const handleDeviceChange = useCallback(async (deviceId: string) => {
    try {
      setIsLoading(true);
      setSelectedDeviceId(deviceId);
      
      if (isConnected) {
        await handleDisconnect();
        await handleConnect();
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to switch device');
      onError?.(err);
      toast.error('Failed to switch device');
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, handleDisconnect, handleConnect, onError]);

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
          disabled={isLoading}
          className={`px-4 py-2 rounded-lg font-medium text-white transition-all duration-200 ${
            isConnected
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-green-500 hover:bg-green-600'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isLoading ? 'Loading...' : isConnected ? 'Disconnect' : 'Connect'}
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

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Audio Input Device
        </label>
        <select
          value={selectedDeviceId}
          onChange={(e) => handleDeviceChange(e.target.value)}
          disabled={isLoading || !availableDevices.length}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
        >
          {availableDevices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Microphone ${device.deviceId.slice(0, 4)}`}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
} 
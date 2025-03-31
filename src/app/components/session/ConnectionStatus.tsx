'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Wifi, WifiOff } from 'lucide-react';

interface ConnectionStatusProps {
  isConnected: boolean;
}

export function ConnectionStatus({ isConnected }: ConnectionStatusProps) {
  return (
    <Card className="p-4 mt-4">
      <div className="flex items-center space-x-2">
        {isConnected ? (
          <>
            <Wifi className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-green-600">Connected</span>
          </>
        ) : (
          <>
            <WifiOff className="h-5 w-5 text-red-600" />
            <span className="text-sm font-medium text-red-600">Disconnected</span>
          </>
        )}
      </div>
    </Card>
  );
} 
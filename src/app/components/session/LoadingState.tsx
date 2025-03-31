'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export function LoadingState() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="p-6">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">Loading...</span>
        </div>
      </Card>
    </div>
  );
} 
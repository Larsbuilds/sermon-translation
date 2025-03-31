'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const HomeContent = dynamic(() => import('./HomeContent'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
} 
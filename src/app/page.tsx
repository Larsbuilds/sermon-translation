import { Suspense } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the HomeContent component with no SSR
const HomeContent = dynamic(() => import('./components/HomeContent'), {
  ssr: false,
});

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
} 
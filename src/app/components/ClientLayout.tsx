'use client';

import { SessionProvider } from '../contexts/SessionContext';
import { TranslationProvider } from '../contexts/TranslationContext';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <TranslationProvider>
        {children}
      </TranslationProvider>
    </SessionProvider>
  );
} 
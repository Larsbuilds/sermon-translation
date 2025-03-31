'use client';

import { SessionProvider } from '../contexts/SessionContext';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  );
} 
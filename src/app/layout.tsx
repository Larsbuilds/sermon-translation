import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css'
import ClientLayout from './components/ClientLayout';
import { Toaster } from 'sonner';
import { ErrorBoundary } from './components/ErrorBoundary';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Sermon Translation System',
  description: 'Real-time translation and transcription for sermons',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary>
          <ClientLayout>
            {children}
          </ClientLayout>
        </ErrorBoundary>
        <Toaster />
      </body>
    </html>
  )
}

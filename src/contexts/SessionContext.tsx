import React, { createContext, useContext, useState, useEffect } from 'react';

interface Session {
  id: string;
  name: string;
  speaker: string;
  status: 'active' | 'ended';
  listeners: number;
  audioUrl?: string;
}

interface SessionContextType {
  currentSession: Session | null;
  joinSession: (code: string) => Promise<void>;
  leaveSession: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [currentSession, setCurrentSession] = useState<Session | null>(null);

  const joinSession = async (code: string) => {
    try {
      const response = await fetch(`/api/sessions?code=${code}`);
      if (!response.ok) {
        throw new Error('Failed to join session');
      }
      const session = await response.json();
      setCurrentSession(session);
    } catch (error) {
      console.error('Error joining session:', error);
      throw error;
    }
  };

  const leaveSession = () => {
    setCurrentSession(null);
  };

  return (
    <SessionContext.Provider value={{ currentSession, joinSession, leaveSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
} 
'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { SessionDB } from '@/lib/db/indexedDB';

export interface Session {
  id: string;
  name: string;
  speaker: string;
  status: 'active' | 'ended';
  listeners: number;
  createdAt: Date;
  endedAt?: Date;
  participants: string[];
  sessionCode: string;
}

interface SessionContextType {
  sessions: Session[];
  currentSession: Session | null;
  startSession: (name: string, speaker: string) => Session;
  joinSession: (sessionCode: string) => void;
  endSession: () => void;
  leaveSession: () => void;
  updateListenerCount: (sessionId: string, count: number) => void;
  removeParticipant: (sessionCode: string, participantId: string) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

const generateSessionCode = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
};

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [db] = useState(() => new SessionDB());

  // Initialize database and load sessions
  useEffect(() => {
    const initDB = async () => {
      try {
        await db.init();
        const loadedSessions = await db.getSessions();
        console.log('Loaded sessions from IndexedDB:', loadedSessions);
        setSessions(loadedSessions);
      } catch (error) {
        console.error('Error initializing database:', error);
      }
    };
    initDB();
  }, [db]);

  // Save sessions to IndexedDB whenever they change
  useEffect(() => {
    const saveSessions = async () => {
      try {
        console.log('Saving sessions to IndexedDB:', sessions);
        for (const session of sessions) {
          await db.saveSession(session);
        }
      } catch (error) {
        console.error('Error saving sessions to IndexedDB:', error);
      }
    };
    saveSessions();
  }, [sessions, db]);

  // Save current session to IndexedDB whenever it changes
  useEffect(() => {
    const saveCurrentSession = async () => {
      try {
        if (currentSession) {
          console.log('Saving current session to IndexedDB:', currentSession);
          await db.saveSession(currentSession);
        }
      } catch (error) {
        console.error('Error saving current session to IndexedDB:', error);
      }
    };
    saveCurrentSession();
  }, [currentSession, db]);

  const startSession = useCallback((name: string, speaker: string) => {
    const sessionId = name.toLowerCase().replace(/\s+/g, '-');
    const sessionCode = generateSessionCode();
    console.log('Starting new session with code:', sessionCode);
    
    const newSession: Session = {
      id: sessionId,
      name,
      speaker: 'You',
      status: 'active',
      listeners: 0,
      createdAt: new Date(),
      participants: ['You'],
      sessionCode
    };

    console.log('Creating new session:', newSession);

    setSessions(prev => {
      const newSessions = [...prev, newSession];
      console.log('Updated sessions after start:', newSessions);
      return newSessions;
    });
    
    setCurrentSession(newSession);

    return newSession;
  }, []);

  const endSession = useCallback(() => {
    if (currentSession) {
      const updatedSession: Session = {
        ...currentSession,
        status: 'ended' as const,
        endedAt: new Date()
      };
      
      setSessions(prev => 
        prev.map(session => 
          session.sessionCode === currentSession.sessionCode ? updatedSession : session
        )
      );
      setCurrentSession(null);
    }
  }, [currentSession]);

  const updateListenerCount = useCallback((sessionId: string, count: number) => {
    setSessions(prev => 
      prev.map(session => 
        session.id === sessionId 
          ? { ...session, listeners: count }
          : session
      )
    );
  }, []);

  const removeParticipant = useCallback((sessionCode: string, participantId: string) => {
    console.log('Removing participant:', { sessionCode, participantId });
    
    setSessions(prev => {
      const newSessions = prev.map(session => {
        if (session.sessionCode === sessionCode) {
          console.log('Updating session:', session);
          const updatedSession = {
            ...session,
            participants: session.participants.filter(p => p !== participantId),
            listeners: Math.max(0, session.listeners - 1)
          };
          console.log('Updated session:', updatedSession);
          return updatedSession;
        }
        return session;
      });
      console.log('Updated sessions:', newSessions);
      return newSessions;
    });

    setCurrentSession(prev => {
      if (prev?.sessionCode === sessionCode) {
        console.log('Updating current session:', prev);
        const updatedSession = {
          ...prev,
          participants: prev.participants.filter(p => p !== participantId),
          listeners: Math.max(0, prev.listeners - 1)
        };
        console.log('Updated current session:', updatedSession);
        return updatedSession;
      }
      return prev;
    });
  }, []);

  const leaveSession = useCallback(() => {
    if (currentSession) {
      console.log('Leaving session:', currentSession);
      if (currentSession.speaker !== 'You') {
        removeParticipant(currentSession.sessionCode, 'You');
      }
      setCurrentSession(null);
    }
  }, [currentSession, removeParticipant]);

  const joinSession = useCallback(async (sessionCode: string) => {
    if (!sessionCode) {
      throw new Error('Session code is required');
    }

    // First, leave the current session if any
    if (currentSession) {
      console.log('Leaving current session before joining new one:', currentSession);
      if (currentSession.speaker !== 'You') {
        removeParticipant(currentSession.sessionCode, 'You');
      }
      setCurrentSession(null);
    }

    console.log('Attempting to join session with code:', sessionCode);

    // Try to find the session in IndexedDB
    let session = await db.getSession(sessionCode);
    
    if (!session) {
      console.error('Session not found for code:', sessionCode);
      throw new Error('Session not found');
    }

    // Check if the session is actually ended
    if (session.status === 'ended' && session.endedAt) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (session.endedAt > oneHourAgo) {
        // If the session was ended less than an hour ago, reactivate it
        const reactivatedSession: Session = {
          ...session,
          status: 'active' as const,
          endedAt: undefined
        };
        console.log('Reactivating ended session:', reactivatedSession);
        await db.saveSession(reactivatedSession);
        session = reactivatedSession;
      } else {
        throw new Error('Session has ended');
      }
    }

    // Check if user is already in this session
    if (session.participants.includes('You')) {
      console.log('User is already in this session, updating current session');
      setCurrentSession(session);
      return;
    }

    const updatedSession: Session = {
      ...session,
      participants: [...session.participants, 'You'],
      listeners: session.listeners + 1
    };
    
    console.log('Updating session:', updatedSession);
    
    // Update both sessions and currentSession states
    setSessions(prev => {
      const newSessions = prev.map(s => 
        s.sessionCode === session.sessionCode ? updatedSession : s
      );
      console.log('Updated sessions:', newSessions);
      return newSessions;
    });

    setCurrentSession(updatedSession);
  }, [currentSession, db, removeParticipant]);

  // Add navigation event listener to clear current session
  useEffect(() => {
    const handleNavigation = () => {
      if (currentSession) {
        console.log('Navigation detected, clearing current session');
        setCurrentSession(null);
      }
    };

    window.addEventListener('popstate', handleNavigation);
    return () => window.removeEventListener('popstate', handleNavigation);
  }, [currentSession]);

  return (
    <SessionContext.Provider value={{
      sessions,
      currentSession,
      startSession,
      joinSession,
      endSession,
      leaveSession,
      updateListenerCount,
      removeParticipant
    }}>
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
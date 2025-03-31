'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

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

const STORAGE_KEY = 'sermon-translation-sessions';

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
  const [sessions, setSessions] = useState<Session[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedSessions = localStorage.getItem(STORAGE_KEY);
        console.log('Initial load from localStorage:', savedSessions);
        if (savedSessions) {
          const parsedSessions = JSON.parse(savedSessions);
          // Convert date strings back to Date objects
          const sessionsWithDates = parsedSessions.map((session: any) => ({
            ...session,
            createdAt: new Date(session.createdAt),
            endedAt: session.endedAt ? new Date(session.endedAt) : undefined
          }));
          console.log('Parsed sessions with dates:', sessionsWithDates);
          return sessionsWithDates;
        }
      } catch (error) {
        console.error('Error loading sessions from localStorage:', error);
      }
    }
    return [];
  });

  const [currentSession, setCurrentSession] = useState<Session | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedCurrentSession = localStorage.getItem('current-session');
        if (savedCurrentSession) {
          const parsedSession = JSON.parse(savedCurrentSession);
          return {
            ...parsedSession,
            createdAt: new Date(parsedSession.createdAt),
            endedAt: parsedSession.endedAt ? new Date(parsedSession.endedAt) : undefined
          };
        }
      } catch (error) {
        console.error('Error loading current session from localStorage:', error);
      }
    }
    return null;
  });

  // Add storage event listener to sync between windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsedSessions = JSON.parse(e.newValue);
          const sessionsWithDates = parsedSessions.map((session: any) => ({
            ...session,
            createdAt: new Date(session.createdAt),
            endedAt: session.endedAt ? new Date(session.endedAt) : undefined
          }));
          console.log('Syncing sessions from storage event:', sessionsWithDates);
          setSessions(sessionsWithDates);
        } catch (error) {
          console.error('Error syncing sessions from storage event:', error);
        }
      } else if (e.key === 'current-session' && e.newValue) {
        try {
          const parsedSession = JSON.parse(e.newValue);
          const sessionWithDates = {
            ...parsedSession,
            createdAt: new Date(parsedSession.createdAt),
            endedAt: parsedSession.endedAt ? new Date(parsedSession.endedAt) : undefined
          };
          console.log('Syncing current session from storage event:', sessionWithDates);
          setCurrentSession(sessionWithDates);
        } catch (error) {
          console.error('Error syncing current session from storage event:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        console.log('Saving sessions to localStorage:', sessions);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
      } catch (error) {
        console.error('Error saving sessions to localStorage:', error);
      }
    }
  }, [sessions]);

  // Save current session to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && currentSession) {
      console.log('Saving current session to localStorage:', currentSession);
      try {
        localStorage.setItem('current-session', JSON.stringify(currentSession));
      } catch (error) {
        console.error('Error saving current session to localStorage:', error);
      }
    } else if (typeof window !== 'undefined') {
      localStorage.removeItem('current-session');
    }
  }, [currentSession]);

  // Cleanup ended sessions after 1 hour
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      setSessions(prevSessions => 
        prevSessions.filter(session => 
          session.status === 'active' || 
          (session.endedAt && session.endedAt > oneHourAgo)
        )
      );
    }, 60000); // Check every minute

    return () => clearInterval(cleanupInterval);
  }, []);

  // Handle page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentSession) {
        if (currentSession.speaker !== 'You') {
          removeParticipant(currentSession.sessionCode, 'You');
        } else {
          endSession();
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentSession]);

  const startSession = useCallback((name: string, speaker: string) => {
    const sessionId = name.toLowerCase().replace(/\s+/g, '-');
    const sessionCode = generateSessionCode();
    console.log('Starting new session with code:', sessionCode);
    
    const newSession: Session = {
      id: sessionId,
      name,
      speaker: 'You', // Always set speaker as 'You' for the creator
      status: 'active',
      listeners: 0,
      createdAt: new Date(),
      participants: ['You'], // Initialize with the speaker
      sessionCode
    };

    console.log('Creating new session:', newSession);

    setSessions(prev => {
      const newSessions = [...prev, newSession];
      console.log('Updated sessions after start:', newSessions);
      return newSessions;
    });
    
    setCurrentSession(newSession);

    // Save to localStorage immediately
    try {
      const updatedSessions = [...sessions, newSession];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions));
      localStorage.setItem('current-session', JSON.stringify(newSession));
      console.log('Saved new session to localStorage:', updatedSessions);
    } catch (error) {
      console.error('Error saving new session to localStorage:', error);
    }

    return newSession;
  }, [sessions]);

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
      localStorage.removeItem('current-session');
    }
  }, [currentSession, removeParticipant]);

  const joinSession = useCallback((sessionCode: string) => {
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
      localStorage.removeItem('current-session');
    }

    console.log('Attempting to join session with code:', sessionCode);
    console.log('Available sessions:', sessions);

    // First try to find the session in the current state
    let session = sessions.find(s => {
      const matches = s.sessionCode && s.sessionCode.toUpperCase() === sessionCode.toUpperCase();
      console.log('Comparing session codes:', {
        sessionCode: s.sessionCode,
        inputCode: sessionCode,
        matches,
        status: s.status
      });
      return matches;
    });

    // If not found, try to load from localStorage
    if (!session && typeof window !== 'undefined') {
      try {
        const savedSessions = localStorage.getItem(STORAGE_KEY);
        console.log('Loading sessions from localStorage for join:', savedSessions);
        if (savedSessions) {
          const parsedSessions = JSON.parse(savedSessions);
          const foundSession = parsedSessions.find((s: any) => 
            s.sessionCode && s.sessionCode.toUpperCase() === sessionCode.toUpperCase()
          );
          if (foundSession) {
            console.log('Found session in localStorage:', foundSession);
            // Ensure all required properties are present
            if (!foundSession.id || !foundSession.name || !foundSession.speaker || !foundSession.sessionCode) {
              console.error('Found session is missing required properties:', foundSession);
              throw new Error('Invalid session data');
            }
            // Update the sessions state with the found session
            setSessions(prev => {
              const newSessions = [...prev];
              if (!newSessions.find(s => s.sessionCode === foundSession.sessionCode)) {
                newSessions.push({
                  id: foundSession.id,
                  name: foundSession.name,
                  speaker: foundSession.speaker,
                  status: foundSession.status || 'active',
                  listeners: foundSession.listeners || 0,
                  createdAt: new Date(foundSession.createdAt),
                  endedAt: foundSession.endedAt ? new Date(foundSession.endedAt) : undefined,
                  participants: foundSession.participants || [foundSession.speaker],
                  sessionCode: foundSession.sessionCode
                });
              }
              return newSessions;
            });
            session = {
              ...foundSession,
              status: foundSession.status || 'active',
              createdAt: new Date(foundSession.createdAt),
              endedAt: foundSession.endedAt ? new Date(foundSession.endedAt) : undefined
            };
          }
        }
      } catch (error) {
        console.error('Error loading sessions from localStorage for join:', error);
      }
    }
    
    if (!session) {
      console.error('Session not found for code:', sessionCode);
      throw new Error('Session not found');
    }

    // Check if the session is actually ended
    if (session.status === 'ended' && session.endedAt) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (session.endedAt > oneHourAgo) {
        // If the session was ended less than an hour ago, reactivate it
        session = {
          ...session,
          status: 'active',
          endedAt: undefined
        };
        console.log('Reactivating ended session:', session);
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

    const updatedSession = {
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

    // Always update the currentSession for both speaker and listener
    setCurrentSession(updatedSession);

    // Save to localStorage immediately
    try {
      const updatedSessions = sessions.map(s => 
        s.sessionCode === session.sessionCode ? updatedSession : s
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions));
      localStorage.setItem('current-session', JSON.stringify(updatedSession));
      console.log('Saved updated session to localStorage:', updatedSessions);
    } catch (error) {
      console.error('Error saving updated session to localStorage:', error);
    }
  }, [sessions, currentSession, removeParticipant]);

  // Add navigation event listener to clear current session
  useEffect(() => {
    const handleNavigation = () => {
      if (currentSession) {
        console.log('Navigation detected, clearing current session');
        setCurrentSession(null);
        localStorage.removeItem('current-session');
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
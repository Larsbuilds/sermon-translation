'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

export interface Session {
  id: string;
  name: string;
  speaker: string;
  status: 'active' | 'ended';
  listenerCount: number;
  createdAt: Date;
  endedAt?: Date;
  participants: string[];
  sessionCode: string;
  autoEnd: boolean;
  autoEndMinutes: number;
  allowListeners: boolean;
  maxListeners: number;
}

export interface AudioDevice {
  deviceId: string;
  label: string;
  isActive: boolean;
}

export interface Participant {
  id: string;
  name: string;
  isSpeaking: boolean;
  role: 'speaker' | 'listener';
}

interface SessionContextType {
  sessions: Session[];
  currentSession: Session | null;
  isConnected: boolean;
  isSpeaking: boolean;
  setIsSpeaking: (isSpeaking: boolean) => void;
  devices: AudioDevice[];
  selectedDeviceId: string;
  onDeviceSelect: (deviceId: string) => void;
  onTestDevice: (deviceId: string) => void;
  participants: Participant[];
  onRemoveParticipant: (id: string) => void;
  duration: number;
  timeRemaining: number;
  onExtendSession: () => void;
  onEndSession: () => void;
  isLoading: boolean;
  error: string | null;
  startSession: (name: string, speaker: string) => Promise<Session>;
  joinSession: (sessionCode: string) => Promise<void>;
  endSession: () => Promise<void>;
  leaveSession: () => Promise<void>;
  updateListenerCount: (sessionId: string, count: number) => Promise<void>;
  removeParticipant: (sessionCode: string, participantId: string) => Promise<void>;
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

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [duration, setDuration] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupRef = useRef<NodeJS.Timeout | null>(null);
  const durationRef = useRef<NodeJS.Timeout | null>(null);

  // Load sessions from server
  useEffect(() => {
    const loadSessions = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/sessions');
        const loadedSessions = await response.json();
        console.log('Loaded sessions from server:', loadedSessions);
        setSessions(loadedSessions);
      } catch (error) {
        console.error('Error loading sessions:', error);
        toast.error('Failed to load sessions');
        setError('Failed to load sessions');
      } finally {
        setIsLoading(false);
      }
    };
    loadSessions();
  }, []);

  // Start session timeout when a session is created
  const startSessionTimeout = useCallback((sessionId: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(async () => {
      const session = sessions.find(s => s.id === sessionId);
      if (session && session.status === 'active') {
        await endSession();
        toast.info('Session ended due to inactivity');
      }
    }, SESSION_TIMEOUT);
  }, [sessions]);

  // Cleanup inactive sessions
  const cleanupInactiveSessions = useCallback(async () => {
    try {
      const response = await fetch('/api/sessions/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timeout: SESSION_TIMEOUT
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to cleanup sessions');
      }

      const updatedSessions = await response.json();
      setSessions(updatedSessions);
    } catch (error) {
      console.error('Error cleaning up sessions:', error);
    }
  }, []);

  // Start cleanup interval
  useEffect(() => {
    cleanupRef.current = setInterval(cleanupInactiveSessions, CLEANUP_INTERVAL);
    return () => {
      if (cleanupRef.current) {
        clearInterval(cleanupRef.current);
      }
    };
  }, [cleanupInactiveSessions]);

  const startSession = useCallback(async (name: string, speaker: string) => {
    const sessionId = name.toLowerCase().replace(/\s+/g, '-');
    const sessionCode = generateSessionCode();
    console.log('Starting new session with code:', sessionCode);
    
    const newSession: Session = {
      id: sessionId,
      name,
      speaker: 'You',
      status: 'active',
      listenerCount: 0,
      createdAt: new Date(),
      participants: ['You'],
      sessionCode,
      autoEnd: false,
      autoEndMinutes: 30,
      allowListeners: true,
      maxListeners: 10
    };

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSession),
      });

      if (!response.ok) {
        throw new Error('Failed to save session');
      }

      const savedSession = await response.json();
      setSessions(prev => [...prev, savedSession]);
      setCurrentSession(savedSession);
      startSessionTimeout(sessionId);

      return savedSession;
    } catch (error) {
      console.error('Error saving session:', error);
      toast.error('Failed to start session');
      throw error;
    }
  }, [startSessionTimeout]);

  const endSession = useCallback(async () => {
    if (currentSession) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      const updatedSession: Session = {
        ...currentSession,
        status: 'ended' as const,
        endedAt: new Date()
      };
      
      try {
        const response = await fetch('/api/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedSession),
        });

        if (!response.ok) {
          throw new Error('Failed to update session');
        }

        const savedSession = await response.json();
        
        setSessions(prev => 
          prev.map(session => 
            session.sessionCode === currentSession.sessionCode ? savedSession : session
          )
        );
        setCurrentSession(null);
        toast.success('Session ended successfully');
      } catch (error) {
        console.error('Error ending session:', error);
        toast.error('Failed to end session');
        throw error;
      }
    }
  }, [currentSession]);

  const updateListenerCount = useCallback(async (sessionId: string, count: number) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const updatedSession: Session = {
      ...session,
      listenerCount: count
    };

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedSession),
      });

      if (!response.ok) {
        throw new Error('Failed to update session');
      }

      const savedSession = await response.json();
      
      setSessions(prev => 
        prev.map(s => 
          s.id === sessionId ? savedSession : s
        )
      );
    } catch (error) {
      console.error('Error updating listener count:', error);
      throw error;
    }
  }, [sessions]);

  const removeParticipant = useCallback(async (sessionCode: string, participantId: string) => {
    console.log('Removing participant:', { sessionCode, participantId });
    
    const session = sessions.find(s => s.sessionCode === sessionCode);
    if (!session) return;

    const updatedSession: Session = {
      ...session,
      participants: session.participants.filter(p => p !== participantId),
      listenerCount: Math.max(0, session.listenerCount - 1)
    };

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedSession),
      });

      if (!response.ok) {
        throw new Error('Failed to update session');
      }

      const savedSession = await response.json();
      
      setSessions(prev => 
        prev.map(s => 
          s.sessionCode === sessionCode ? savedSession : s
        )
      );

      setCurrentSession(prev => 
        prev?.sessionCode === sessionCode ? savedSession : prev
      );
    } catch (error) {
      console.error('Error removing participant:', error);
      throw error;
    }
  }, [sessions]);

  const leaveSession = useCallback(async () => {
    if (currentSession) {
      console.log('Leaving session:', currentSession);
      if (currentSession.speaker !== 'You') {
        await removeParticipant(currentSession.sessionCode, 'You');
      }
      setCurrentSession(null);
    }
  }, [currentSession, removeParticipant]);

  const joinSession = useCallback(async (sessionCode: string) => {
    if (!sessionCode) {
      throw new Error('Session code is required');
    }

    console.log('Attempting to join session with code:', sessionCode);

    // First, leave the current session if any
    if (currentSession) {
      console.log('Leaving current session before joining new one:', currentSession);
      if (currentSession.speaker !== 'You') {
        await removeParticipant(currentSession.sessionCode, 'You');
      }
      setCurrentSession(null);
    }

    try {
      const response = await fetch(`/api/sessions?code=${sessionCode}`);
      if (!response.ok) {
        throw new Error('Session not found');
      }

      let session = await response.json();
      console.log('Found session:', session);

      // Check if the session is actually ended
      if (session.status === 'ended' && session.endedAt) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (new Date(session.endedAt) > oneHourAgo) {
          // If the session was ended less than an hour ago, reactivate it
          const reactivatedSession: Session = {
            ...session,
            status: 'active' as const,
            endedAt: undefined
          };
          console.log('Reactivating ended session:', reactivatedSession);
          
          const reactivateResponse = await fetch('/api/sessions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(reactivatedSession),
          });

          if (!reactivateResponse.ok) {
            throw new Error('Failed to reactivate session');
          }

          session = await reactivateResponse.json();
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
        listenerCount: session.listenerCount + 1
      };
      
      console.log('Updating session:', updatedSession);
      
      const updateResponse = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedSession),
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update session');
      }

      const savedSession = await updateResponse.json();
      console.log('Successfully saved updated session:', savedSession);
      
      setSessions(prev => 
        prev.map(s => 
          s.sessionCode === session.sessionCode ? savedSession : s
        )
      );

      setCurrentSession(savedSession);
    } catch (error) {
      console.error('Error joining session:', error);
      throw error;
    }
  }, [currentSession, removeParticipant]);

  const value: SessionContextType = {
    sessions,
    currentSession,
    isConnected,
    isSpeaking,
    setIsSpeaking,
    devices,
    selectedDeviceId,
    onDeviceSelect: (deviceId: string) => {
      setSelectedDeviceId(deviceId);
    },
    onTestDevice: (deviceId: string) => {
      // Implementation needed
    },
    participants,
    onRemoveParticipant: (id: string) => {
      if (currentSession) {
        removeParticipant(currentSession.sessionCode, id);
      }
    },
    duration,
    timeRemaining,
    onExtendSession: () => {
      // Implementation needed
    },
    onEndSession: endSession,
    isLoading,
    error,
    startSession,
    joinSession,
    endSession,
    leaveSession,
    updateListenerCount,
    removeParticipant,
  };

  return (
    <SessionContext.Provider value={value}>
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
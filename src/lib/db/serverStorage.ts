import { Session } from '@/app/contexts/SessionContext';

class ServerStorage {
  private static instance: ServerStorage;
  private sessions: Map<string, Session>;

  private constructor() {
    this.sessions = new Map();
  }

  public static getInstance(): ServerStorage {
    if (!ServerStorage.instance) {
      ServerStorage.instance = new ServerStorage();
    }
    return ServerStorage.instance;
  }

  async saveSession(session: Session): Promise<void> {
    console.log('Saving session to server:', session);
    this.sessions.set(session.sessionCode, session);
  }

  async getSession(sessionCode: string): Promise<Session | null> {
    console.log('Getting session from server with code:', sessionCode);
    const session = this.sessions.get(sessionCode);
    if (session) {
      console.log('Found session on server:', session);
      return session;
    }
    console.log('No session found on server with code:', sessionCode);
    return null;
  }

  async getAllSessions(): Promise<Session[]> {
    console.log('Getting all sessions from server');
    const sessions = Array.from(this.sessions.values());
    console.log('Retrieved sessions from server:', sessions);
    return sessions;
  }

  async deleteSession(sessionCode: string): Promise<void> {
    console.log('Deleting session from server with code:', sessionCode);
    this.sessions.delete(sessionCode);
  }
}

export const serverStorage = ServerStorage.getInstance(); 
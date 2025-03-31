import { Session } from '@/app/contexts/SessionContext';

const DB_NAME = 'sermon-translation-db';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

export class SessionDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Initializing IndexedDB...');
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Error opening IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('Successfully opened IndexedDB');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        console.log('Upgrading IndexedDB schema...');
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'sessionCode' });
          console.log('Created sessions store');
        }
      };
    });
  }

  async getSessions(): Promise<Session[]> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      console.log('Getting all sessions from IndexedDB...');
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => {
        console.error('Error getting sessions:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const sessions = request.result.map((session: any) => ({
          ...session,
          createdAt: new Date(session.createdAt),
          endedAt: session.endedAt ? new Date(session.endedAt) : undefined
        }));
        console.log('Retrieved sessions from IndexedDB:', sessions);
        resolve(sessions);
      };
    });
  }

  async saveSession(session: Session): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      console.log('Saving session to IndexedDB:', session);
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(session);

      request.onerror = () => {
        console.error('Error saving session:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log('Successfully saved session to IndexedDB');
        resolve();
      };
    });
  }

  async getSession(sessionCode: string): Promise<Session | null> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      console.log('Getting session from IndexedDB with code:', sessionCode);
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(sessionCode);

      request.onerror = () => {
        console.error('Error getting session:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const session = request.result;
        if (session) {
          const sessionWithDates = {
            ...session,
            createdAt: new Date(session.createdAt),
            endedAt: session.endedAt ? new Date(session.endedAt) : undefined
          };
          console.log('Retrieved session from IndexedDB:', sessionWithDates);
          resolve(sessionWithDates);
        } else {
          console.log('No session found with code:', sessionCode);
          resolve(null);
        }
      };
    });
  }

  async deleteSession(sessionCode: string): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      console.log('Deleting session from IndexedDB with code:', sessionCode);
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(sessionCode);

      request.onerror = () => {
        console.error('Error deleting session:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log('Successfully deleted session from IndexedDB');
        resolve();
      };
    });
  }
} 
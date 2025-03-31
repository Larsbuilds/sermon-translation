import { Session } from '@/app/contexts/SessionContext';

const DB_NAME = 'sermon-translation-db';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

export class SessionDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'sessionCode' });
        }
      };
    });
  }

  async getSessions(): Promise<Session[]> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const sessions = request.result.map((session: any) => ({
          ...session,
          createdAt: new Date(session.createdAt),
          endedAt: session.endedAt ? new Date(session.endedAt) : undefined
        }));
        resolve(sessions);
      };
    });
  }

  async saveSession(session: Session): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(session);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getSession(sessionCode: string): Promise<Session | null> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(sessionCode);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const session = request.result;
        if (session) {
          resolve({
            ...session,
            createdAt: new Date(session.createdAt),
            endedAt: session.endedAt ? new Date(session.endedAt) : undefined
          });
        } else {
          resolve(null);
        }
      };
    });
  }

  async deleteSession(sessionCode: string): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(sessionCode);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
} 
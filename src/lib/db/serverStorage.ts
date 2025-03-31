import { Session as SessionModel } from './models/Session';
import connectDB from './mongodb';

class ServerStorage {
  private static instance: ServerStorage;
  private maxRetries = 2;
  private retryDelay = 500; // 0.5 seconds

  private constructor() {}

  public static getInstance(): ServerStorage {
    if (!ServerStorage.instance) {
      ServerStorage.instance = new ServerStorage();
    }
    return ServerStorage.instance;
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
          continue;
        }
      }
    }
    
    throw lastError;
  }

  async saveSession(session: any): Promise<void> {
    console.log('Saving session to MongoDB:', session);
    await this.withRetry(async () => {
      await connectDB();
      await SessionModel.findOneAndUpdate(
        { sessionCode: session.sessionCode },
        session,
        { upsert: true, new: true, lean: true }
      );
    });
  }

  async getSession(sessionCode: string): Promise<any | null> {
    console.log('Getting session from MongoDB with code:', sessionCode);
    return await this.withRetry(async () => {
      await connectDB();
      const session = await SessionModel.findOne({ sessionCode }).lean();
      if (session) {
        console.log('Found session in MongoDB:', session);
        return session;
      }
      console.log('No session found in MongoDB with code:', sessionCode);
      return null;
    });
  }

  async getAllSessions(): Promise<any[]> {
    console.log('Getting all sessions from MongoDB');
    return await this.withRetry(async () => {
      await connectDB();
      const sessions = await SessionModel.find({}).lean();
      console.log('Retrieved sessions from MongoDB:', sessions);
      return sessions;
    });
  }

  async deleteSession(sessionCode: string): Promise<void> {
    console.log('Deleting session from MongoDB with code:', sessionCode);
    await this.withRetry(async () => {
      await connectDB();
      await SessionModel.deleteOne({ sessionCode });
    });
  }
}

export const serverStorage = ServerStorage.getInstance(); 
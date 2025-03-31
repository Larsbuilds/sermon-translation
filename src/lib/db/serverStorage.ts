import { Session as SessionModel } from './models/Session';
import connectDB from './mongodb';

class ServerStorage {
  private static instance: ServerStorage;

  private constructor() {}

  public static getInstance(): ServerStorage {
    if (!ServerStorage.instance) {
      ServerStorage.instance = new ServerStorage();
    }
    return ServerStorage.instance;
  }

  async saveSession(session: any): Promise<void> {
    console.log('Saving session to MongoDB:', session);
    await connectDB();
    await SessionModel.findOneAndUpdate(
      { sessionCode: session.sessionCode },
      session,
      { upsert: true, new: true }
    );
  }

  async getSession(sessionCode: string): Promise<any | null> {
    console.log('Getting session from MongoDB with code:', sessionCode);
    await connectDB();
    const session = await SessionModel.findOne({ sessionCode });
    if (session) {
      console.log('Found session in MongoDB:', session);
      return session.toObject();
    }
    console.log('No session found in MongoDB with code:', sessionCode);
    return null;
  }

  async getAllSessions(): Promise<any[]> {
    console.log('Getting all sessions from MongoDB');
    await connectDB();
    const sessions = await SessionModel.find({});
    console.log('Retrieved sessions from MongoDB:', sessions);
    return sessions.map(session => session.toObject());
  }

  async deleteSession(sessionCode: string): Promise<void> {
    console.log('Deleting session from MongoDB with code:', sessionCode);
    await connectDB();
    await SessionModel.deleteOne({ sessionCode });
  }
}

export const serverStorage = ServerStorage.getInstance(); 
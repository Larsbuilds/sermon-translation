import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  speaker: { type: String, required: true },
  status: { type: String, enum: ['active', 'ended'], required: true },
  listeners: { type: Number, default: 0 },
  createdAt: { type: Date, required: true },
  endedAt: { type: Date },
  participants: [{ type: String }],
  sessionCode: { type: String, required: true, unique: true }
});

export const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema); 
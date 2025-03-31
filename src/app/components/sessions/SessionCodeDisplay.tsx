'use client';

import { useState } from 'react';
import { useSession } from '../../contexts/SessionContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SessionCodeDisplayProps {
  isSpeaker: boolean;
}

export default function SessionCodeDisplay({ isSpeaker }: SessionCodeDisplayProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const { currentSession, joinSession } = useSession();
  const router = useRouter();

  const handleJoinSession = async () => {
    try {
      setError('');
      await joinSession(code);
      router.push(`/session/${code}`);
    } catch (err) {
      console.error('Error joining session:', err);
      setError('Failed to join session. Please check the code and try again.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length === 6) {
      handleJoinSession();
    }
  };

  if (isSpeaker) {
    return (
      <div className="text-center">
        <h3 className="text-lg font-medium mb-2">Your Session Code</h3>
        <div className="text-3xl font-bold text-primary tracking-wider">
          {currentSession?.sessionCode || 'Generating...'}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-medium mb-4">Join a Session</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sessionCode">Session Code</Label>
          <Input
            id="sessionCode"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter 6-digit code"
            maxLength={6}
            required
            className="text-center tracking-wider text-lg"
          />
        </div>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        <Button type="submit" className="w-full" disabled={code.length !== 6}>
          Join Session
        </Button>
      </form>
    </div>
  );
} 
'use client';

import React, { useState } from 'react';
import { useSession } from '../../contexts/SessionContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';

interface StartSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StartSessionModal({ isOpen, onClose }: StartSessionModalProps) {
  const { startSession } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && speaker.trim()) {
      try {
        setIsSubmitting(true);
        const session = await startSession(name, speaker);
        onClose();
        router.push(`/session/${session.sessionCode}`);
      } catch (error) {
        console.error('Failed to start session:', error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Start New Session</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Session Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter session name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="speaker">Speaker Name</Label>
            <Input
              id="speaker"
              value={speaker}
              onChange={(e) => setSpeaker(e.target.value)}
              placeholder="Enter speaker name"
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Starting...' : 'Start Session'}
          </Button>
        </form>
      </Card>
    </div>
  );
} 
'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  role: 'speaker' | 'listener';
}

interface ParticipantsListProps {
  participants: Participant[];
  onRemoveParticipant: (participantId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function ParticipantsList({
  participants,
  onRemoveParticipant,
  isOpen,
  onClose,
}: ParticipantsListProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Participants</DialogTitle>
          <DialogDescription>
            View and manage session participants
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-4">
            {participants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center justify-between p-2 border rounded-lg"
              >
                <div>
                  <p className="font-medium">{participant.name}</p>
                  <p className="text-sm text-gray-500 capitalize">{participant.role}</p>
                </div>
                {participant.role === 'listener' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveParticipant(participant.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
} 
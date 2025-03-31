import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/dialog';
import { ScrollArea } from '../../components/ui/scroll-area';
import { User, Mic, MicOff } from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  isSpeaking: boolean;
  role: 'speaker' | 'listener';
}

interface ParticipantsListProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Participant[];
  onRemoveParticipant?: (id: string) => void;
}

export const ParticipantsList: React.FC<ParticipantsListProps> = ({
  isOpen,
  onClose,
  participants,
  onRemoveParticipant,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Participants</DialogTitle>
          <DialogDescription>
            {participants.length} participant{participants.length !== 1 ? 's' : ''} in the session
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-2">
            {participants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{participant.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {participant.role}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {participant.isSpeaking ? (
                    <Mic className="h-4 w-4 text-green-500" />
                  ) : (
                    <MicOff className="h-4 w-4 text-red-500" />
                  )}
                  {onRemoveParticipant && participant.role === 'listener' && (
                    <button
                      onClick={() => onRemoveParticipant(participant.id)}
                      className="text-sm text-red-500 hover:text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}; 
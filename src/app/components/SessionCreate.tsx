import React from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Mic, MicOff } from 'lucide-react';
import { SessionSettings } from './SessionSettings';

interface SessionCreateProps {
  onCreate: (settings: {
    name: string;
    autoEnd: boolean;
    autoEndMinutes: number;
    allowListeners: boolean;
    maxListeners: number;
  }) => void;
  isCreating: boolean;
  error?: string;
}

export const SessionCreate: React.FC<SessionCreateProps> = ({
  onCreate,
  isCreating,
  error,
}) => {
  const [name, setName] = React.useState('');
  const [isMicEnabled, setIsMicEnabled] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  const [settings, setSettings] = React.useState({
    autoEnd: false,
    autoEndMinutes: 30,
    allowListeners: true,
    maxListeners: 10,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({
      name,
      ...settings,
    });
  };

  const toggleMic = async () => {
    try {
      if (isMicEnabled) {
        // Stop microphone
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      } else {
        // Start microphone
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      setIsMicEnabled(!isMicEnabled);
    } catch (err) {
      console.error('Error toggling microphone:', err);
    }
  };

  return (
    <Card className="p-6 max-w-md w-full mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="sessionName">Session Name</Label>
          <Input
            id="sessionName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter session name"
            required
            disabled={isCreating}
          />
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={toggleMic}
              className="h-10 w-10"
            >
              {isMicEnabled ? (
                <Mic className="h-5 w-5" />
              ) : (
                <MicOff className="h-5 w-5" />
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSettings(true)}
            >
              Settings
            </Button>
          </div>
          <Button type="submit" disabled={isCreating}>
            {isCreating ? 'Creating...' : 'Create Session'}
          </Button>
        </div>
      </form>

      <SessionSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSave={setSettings}
      />
    </Card>
  );
}; 
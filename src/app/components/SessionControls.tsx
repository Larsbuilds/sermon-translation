import React from 'react';
import { Button } from '../../components/ui/button';
import { Mic, MicOff, Settings, Users } from 'lucide-react';
import { DeviceSelectionModal } from './DeviceSelectionModal';

interface SessionControlsProps {
  isSpeaking: boolean;
  onToggleSpeaking: () => void;
  onOpenSettings: () => void;
  onOpenParticipants: () => void;
  devices: Array<{
    deviceId: string;
    label: string;
    isActive: boolean;
  }>;
  selectedDeviceId: string;
  onDeviceSelect: (deviceId: string) => void;
  onTestDevice: (deviceId: string) => void;
}

export const SessionControls: React.FC<SessionControlsProps> = ({
  isSpeaking,
  onToggleSpeaking,
  onOpenSettings,
  onOpenParticipants,
  devices,
  selectedDeviceId,
  onDeviceSelect,
  onTestDevice,
}) => {
  const [isDeviceModalOpen, setIsDeviceModalOpen] = React.useState(false);

  return (
    <div className="flex items-center space-x-2">
      <Button
        variant={isSpeaking ? 'default' : 'outline'}
        size="icon"
        onClick={onToggleSpeaking}
        className="h-10 w-10"
      >
        {isSpeaking ? (
          <Mic className="h-5 w-5" />
        ) : (
          <MicOff className="h-5 w-5" />
        )}
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsDeviceModalOpen(true)}
        className="h-10 w-10"
      >
        <Settings className="h-5 w-5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onOpenParticipants}
        className="h-10 w-10"
      >
        <Users className="h-5 w-5" />
      </Button>

      <DeviceSelectionModal
        isOpen={isDeviceModalOpen}
        onClose={() => setIsDeviceModalOpen(false)}
        devices={devices}
        selectedDeviceId={selectedDeviceId}
        onDeviceSelect={onDeviceSelect}
        onTestDevice={onTestDevice}
 
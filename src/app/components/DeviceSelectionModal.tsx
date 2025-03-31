import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { Label } from '../../components/ui/label';
import { Mic, MicOff } from 'lucide-react';

interface AudioDevice {
  deviceId: string;
  label: string;
  isActive: boolean;
}

interface DeviceSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: AudioDevice[];
  selectedDeviceId: string;
  onDeviceSelect: (deviceId: string) => void;
  onTestDevice: (deviceId: string) => void;
}

export const DeviceSelectionModal: React.FC<DeviceSelectionModalProps> = ({
  isOpen,
  onClose,
  devices,
  selectedDeviceId,
  onDeviceSelect,
  onTestDevice,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Select Audio Input Device</DialogTitle>
          <DialogDescription>
            Choose your preferred microphone for the session
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <RadioGroup
            value={selectedDeviceId}
            onValueChange={onDeviceSelect}
            className="space-y-2"
          >
            {devices.map((device) => (
              <div
                key={device.deviceId}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent"
              >
                <div className="flex items-center space-x-3">
                  <RadioGroupItem
                    value={device.deviceId}
                    id={device.deviceId}
                  />
                  <Label htmlFor={device.deviceId}>
                    {device.label || 'Unknown Device'}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  {device.isActive ? (
                    <Mic className="h-4 w-4 text-green-500" />
                  ) : (
                    <MicOff className="h-4 w-4 text-red-500" />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onTestDevice(device.deviceId)}
                  >
                    Test
                  </Button>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 
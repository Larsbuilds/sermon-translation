import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Switch } from '../../components/ui/switch';

interface SessionSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  settings: {
    autoEnd: boolean;
    autoEndMinutes: number;
    allowListeners: boolean;
    maxListeners: number;
  };
  onSave: (settings: {
    autoEnd: boolean;
    autoEndMinutes: number;
    allowListeners: boolean;
    maxListeners: number;
  }) => void;
}

export const SessionSettings: React.FC<SessionSettingsProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [localSettings, setLocalSettings] = React.useState(settings);

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Session Settings</DialogTitle>
          <DialogDescription>
            Configure your session preferences
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-end Session</Label>
              <p className="text-sm text-muted-foreground">
                Automatically end the session after a period of inactivity
              </p>
            </div>
            <Switch
              checked={localSettings.autoEnd}
              onCheckedChange={(checked: boolean) =>
                setLocalSettings({ ...localSettings, autoEnd: checked })
              }
            />
          </div>
          {localSettings.autoEnd && (
            <div className="grid gap-2">
              <Label>Auto-end after (minutes)</Label>
              <Input
                type="number"
                min={1}
                max={120}
                value={localSettings.autoEndMinutes}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    autoEndMinutes: parseInt(e.target.value),
                  })
                }
              />
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Allow Listeners</Label>
              <p className="text-sm text-muted-foreground">
                Allow others to join as listeners
              </p>
            </div>
            <Switch
              checked={localSettings.allowListeners}
              onCheckedChange={(checked: boolean) =>
                setLocalSettings({ ...localSettings, allowListeners: checked })
              }
            />
          </div>
          {localSettings.allowListeners && (
            <div className="grid gap-2">
              <Label>Maximum Listeners</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={localSettings.maxListeners}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    maxListeners: parseInt(e.target.value),
                  })
                }
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 
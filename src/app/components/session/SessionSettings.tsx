'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Session } from '@/app/contexts/SessionContext';

interface SessionSettingsProps {
  session: Session;
  isOpen: boolean;
  onClose: () => void;
}

export function SessionSettings({ session, isOpen, onClose }: SessionSettingsProps) {
  const [autoEnd, setAutoEnd] = React.useState(session.autoEnd ?? false);
  const [autoEndMinutes, setAutoEndMinutes] = React.useState(session.autoEndMinutes ?? 30);
  const [allowListeners, setAllowListeners] = React.useState(session.allowListeners ?? true);
  const [maxListeners, setMaxListeners] = React.useState(session.maxListeners ?? 10);

  const handleSave = () => {
    // TODO: Implement save functionality
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Session Settings</DialogTitle>
          <DialogDescription>
            Configure session settings and preferences
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-end">Auto End Session</Label>
            <Switch
              id="auto-end"
              checked={autoEnd}
              onCheckedChange={setAutoEnd}
            />
          </div>
          {autoEnd && (
            <div className="space-y-2">
              <Label htmlFor="auto-end-minutes">Session Duration (minutes)</Label>
              <Input
                id="auto-end-minutes"
                type="number"
                min="1"
                max="120"
                value={autoEndMinutes}
                onChange={(e) => setAutoEndMinutes(Number(e.target.value))}
              />
            </div>
          )}
          <div className="flex items-center justify-between">
            <Label htmlFor="allow-listeners">Allow Listeners</Label>
            <Switch
              id="allow-listeners"
              checked={allowListeners}
              onCheckedChange={setAllowListeners}
            />
          </div>
          {allowListeners && (
            <div className="space-y-2">
              <Label htmlFor="max-listeners">Maximum Listeners</Label>
              <Input
                id="max-listeners"
                type="number"
                min="1"
                max="100"
                value={maxListeners}
                onChange={(e) => setMaxListeners(Number(e.target.value))}
              />
            </div>
          )}
          <div className="flex justify-end space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Save Changes
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
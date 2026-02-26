'use client';

/**
 * MicSetupDialog — test microphone before going live.
 *
 * Shows device picker, live audio level bar, test/go-live buttons.
 * Modelled on the mic dialog in live/page.tsx but extracted as a reusable component.
 */

import { Mic, Radio, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MicSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Mic state from useAudioCapture hook
  micPermission: 'unknown' | 'granted' | 'denied';
  micDevices: { deviceId: string; label: string }[];
  selectedMicId: string;
  onSelectMic: (id: string) => void;
  micLevel: number;           // 0-1 scaled
  micTesting: boolean;
  captureError: string | null;
  // Actions
  onStartTest: () => void;
  onStopTest: () => void;
  onRefreshDevices: () => void;
  onGoLive: () => void;       // Start capture + SSE
}

export function MicSetupDialog({
  open,
  onOpenChange,
  micPermission,
  micDevices,
  selectedMicId,
  onSelectMic,
  micLevel,
  micTesting,
  captureError,
  onStartTest,
  onStopTest,
  onRefreshDevices,
  onGoLive,
}: MicSetupDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) onStopTest();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-emerald-600" />
            Microphone Setup
          </DialogTitle>
          <DialogDescription>
            Select your microphone and test the audio level before going live.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Device selection */}
          <div className="space-y-2">
            <Label>Input device</Label>
            <div className="flex gap-2">
              <Select
                value={selectedMicId}
                onValueChange={(v) => {
                  onSelectMic(v);
                  onStopTest();
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select microphone" />
                </SelectTrigger>
                <SelectContent>
                  {micDevices.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      No devices found
                    </SelectItem>
                  ) : (
                    micDevices.map((d) => (
                      <SelectItem key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onRefreshDevices}
                title="Refresh devices"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Permission: {micPermission === 'granted' ? '✅ Granted' : micPermission === 'denied' ? '❌ Denied' : '⏳ Not yet requested'}
            </p>
          </div>

          {/* Audio level bar */}
          <div className="space-y-2">
            <Label>Audio Level</Label>
            <div className="h-4 w-full rounded-md bg-muted overflow-hidden">
              <div
                className="h-full rounded-md transition-[width] duration-75"
                style={{
                  width: `${Math.round(micLevel * 100)}%`,
                  backgroundColor: micLevel > 0.6 ? '#16a34a' : micLevel > 0.2 ? '#22c55e' : '#86efac',
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {micTesting ? 'Speak now — watch the bar move.' : 'Click "Test Mic" to check your audio.'}
            </p>
          </div>

          {/* Error display */}
          {captureError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {captureError}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {!micTesting ? (
            <Button type="button" variant="outline" onClick={onStartTest}>
              <Mic className="h-4 w-4 mr-2" />
              Test Mic
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={onStopTest}>
              Stop Test
            </Button>
          )}
          <Button
            type="button"
            onClick={onGoLive}
            disabled={micPermission !== 'granted'}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Radio className="h-4 w-4 mr-2" />
            Go Live
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type SnapshotEntry = {
  id: string;
  name: string;
};

type LiveSnapshotsCardProps = {
  snapshotName: string;
  onSnapshotNameChange: (v: string) => void;
  defaultSnapshotName: string;
  isSaving: boolean;
  onSave: () => void;
  snapshots: SnapshotEntry[];
  selectedSnapshotId: string | null;
  onSelectedSnapshotIdChange: (id: string) => void;
  onRefresh: () => void;
  onLoad: () => void;
  snapshotsError: string | null;
};

export function LiveSnapshotsCard({
  snapshotName,
  onSnapshotNameChange,
  defaultSnapshotName,
  isSaving,
  onSave,
  snapshots,
  selectedSnapshotId,
  onSelectedSnapshotIdChange,
  onRefresh,
  onLoad,
  snapshotsError,
}: LiveSnapshotsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Snapshots</CardTitle>
        <CardDescription>Save/load versioned Live states per phase</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label>Name</Label>
          <Input value={snapshotName} onChange={(e) => onSnapshotNameChange(e.target.value)} />
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onSnapshotNameChange(defaultSnapshotName)}
          >
            Use default
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className={`transition-all duration-200 ${
              isSaving ? 'bg-green-600 scale-95' : 'hover:scale-105 active:scale-95'
            }`}
          >
            {isSaving ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 inline"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Saving...
              </>
            ) : (
              'Save snapshot'
            )}
          </Button>
        </div>

        <div className="space-y-1">
          <Label>Load</Label>
          <Select
            value={selectedSnapshotId || '__none'}
            onValueChange={(v) => onSelectedSnapshotIdChange(v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a snapshot" />
            </SelectTrigger>
            <SelectContent>
              {snapshots.length === 0 ? (
                <SelectItem value="__none" disabled>
                  No snapshots yet
                </SelectItem>
              ) : (
                snapshots.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onRefresh}>
            Refresh
          </Button>
          <Button type="button" disabled={!selectedSnapshotId} onClick={onLoad}>
            Load snapshot
          </Button>
        </div>

        {snapshotsError ? (
          <div className="text-sm text-red-600">{snapshotsError}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

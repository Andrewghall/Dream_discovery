'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClipboardCheck, UserCircle, Building2, MapPin } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SessionFormData = {
  captureType:
    | 'WALKAROUND'
    | 'EXECUTIVE_INTERVIEW'
    | 'MANAGER_INTERVIEW'
    | 'OPERATIONAL_INTERVIEW';
  actorRole: string;
  area: string;
  department: string;
  participantName: string;
  consentFlag: boolean;
};

type ActorTaxonomyEntry = {
  key: string;
  label: string;
  description?: string;
};

export type DomainPack = {
  actorTaxonomy: ActorTaxonomyEntry[];
  [key: string]: unknown;
};

type CaptureSessionFormProps = {
  onSubmit: (data: SessionFormData) => void;
  domainPackConfig?: DomainPack | null;
  onCancel?: () => void;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CAPTURE_TYPES: {
  value: SessionFormData['captureType'];
  label: string;
}[] = [
  { value: 'WALKAROUND', label: 'Walkaround' },
  { value: 'EXECUTIVE_INTERVIEW', label: 'Executive Interview' },
  { value: 'MANAGER_INTERVIEW', label: 'Manager Interview' },
  { value: 'OPERATIONAL_INTERVIEW', label: 'Operational Interview' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CaptureSessionForm({
  onSubmit,
  domainPackConfig,
  onCancel,
}: CaptureSessionFormProps) {
  const [captureType, setCaptureType] =
    React.useState<SessionFormData['captureType']>('WALKAROUND');
  const [actorRole, setActorRole] = React.useState('');
  const [area, setArea] = React.useState('');
  const [department, setDepartment] = React.useState('');
  const [participantName, setParticipantName] = React.useState('');
  const [consentFlag, setConsentFlag] = React.useState(false);

  const hasDomainPack =
    domainPackConfig &&
    domainPackConfig.actorTaxonomy &&
    domainPackConfig.actorTaxonomy.length > 0;

  const canSubmit = consentFlag && captureType;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      captureType,
      actorRole,
      area,
      department,
      participantName,
      consentFlag,
    });
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardCheck className="size-5" />
          New Capture Session
        </CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Capture Type */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="capture-type">Capture Type</Label>
            <Select
              value={captureType}
              onValueChange={(v) =>
                setCaptureType(v as SessionFormData['captureType'])
              }
            >
              <SelectTrigger id="capture-type" className="w-full">
                <SelectValue placeholder="Select capture type" />
              </SelectTrigger>
              <SelectContent>
                {CAPTURE_TYPES.map((ct) => (
                  <SelectItem key={ct.value} value={ct.value}>
                    {ct.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Actor Role */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="actor-role">
              <UserCircle className="size-4" />
              Actor Role
            </Label>
            {hasDomainPack ? (
              <Select value={actorRole} onValueChange={setActorRole}>
                <SelectTrigger id="actor-role" className="w-full">
                  <SelectValue placeholder="Select actor role" />
                </SelectTrigger>
                <SelectContent>
                  {domainPackConfig.actorTaxonomy.map((actor) => (
                    <SelectItem key={actor.key} value={actor.key}>
                      {actor.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="actor-role"
                placeholder="e.g. Store Manager, Line Operator"
                value={actorRole}
                onChange={(e) => setActorRole(e.target.value)}
              />
            )}
          </div>

          {/* Area */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="area">
              <MapPin className="size-4" />
              Area
            </Label>
            <Input
              id="area"
              placeholder="e.g. Warehouse Floor, Head Office"
              value={area}
              onChange={(e) => setArea(e.target.value)}
            />
          </div>

          {/* Department */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="department">
              <Building2 className="size-4" />
              Department
            </Label>
            <Input
              id="department"
              placeholder="e.g. Operations, Marketing"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </div>

          {/* Participant Name (optional) */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="participant-name">
              Participant Name{' '}
              <span className="text-muted-foreground text-xs font-normal">
                (optional)
              </span>
            </Label>
            <Input
              id="participant-name"
              placeholder="Name of the person being recorded"
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
            />
          </div>

          {/* Consent Checkbox */}
          <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <input
              id="consent-flag"
              type="checkbox"
              checked={consentFlag}
              onChange={(e) => setConsentFlag(e.target.checked)}
              className="mt-0.5 size-4 rounded border-gray-300 accent-amber-600"
            />
            <Label
              htmlFor="consent-flag"
              className="text-sm leading-snug font-normal text-amber-900"
            >
              I confirm that the participant has given verbal consent to be
              recorded and that the recording will be used for discovery
              analysis purposes only.
            </Label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={!canSubmit}>
              Start Session
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

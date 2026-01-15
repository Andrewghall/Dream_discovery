'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type RatingKey = 'current' | 'target' | 'projected';

function bandForScore(score: number | null): {
  band: string;
  colorClass: string;
} {
  if (!score) return { band: '—', colorClass: 'bg-muted' };
  if (score <= 2) return { band: 'Reactive', colorClass: 'bg-red-100' };
  if (score <= 4) return { band: 'Emerging', colorClass: 'bg-orange-100' };
  if (score <= 6) return { band: 'Defined', colorClass: 'bg-yellow-100' };
  if (score <= 8) return { band: 'Optimised', colorClass: 'bg-green-100' };
  return { band: 'Intelligent', colorClass: 'bg-blue-100' };
}

export function TripleRatingInput({
  disabled,
  onSubmit,
}: {
  disabled?: boolean;
  onSubmit: (value: string) => void;
}) {
  const [ratings, setRatings] = useState<Record<RatingKey, number | null>>({
    current: null,
    target: null,
    projected: null,
  });

  const complete = ratings.current !== null && ratings.target !== null && ratings.projected !== null;

  const rows: Array<{ key: RatingKey; label: string; helper: string }> = useMemo(
    () => [
      { key: 'current', label: 'Current', helper: 'How things are today' },
      { key: 'target', label: 'Target', helper: 'Where it needs to be in 18 months' },
      { key: 'projected', label: 'Projected', helper: 'Where it will be if nothing changes' },
    ],
    []
  );

  const scores = useMemo(() => Array.from({ length: 10 }, (_, i) => i + 1), []);

  const handlePick = (key: RatingKey, value: number) => {
    setRatings((prev) => ({ ...prev, [key]: value }));
  };

  const submit = () => {
    const value = `Current: ${ratings.current}\nTarget: ${ratings.target}\nProjected: ${ratings.projected}`;
    onSubmit(value);
    setRatings({ current: null, target: null, projected: null });
  };

  return (
    <div className="w-full rounded-lg border bg-background p-3 sm:p-4 space-y-3">
      <div className="text-sm font-medium">Quick rating (click 1–10 for each)</div>
      <div className="text-xs text-muted-foreground">Maturity bands: 1–2 Reactive, 3–4 Emerging, 5–6 Defined, 7–8 Optimised, 9–10 Intelligent</div>

      <div className="space-y-3">
        {rows.map((row) => {
          const currentVal = ratings[row.key];
          const band = bandForScore(currentVal);

          return (
            <div key={row.key} className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium leading-tight">{row.label}</div>
                  <div className="text-xs text-muted-foreground">{row.helper}</div>
                </div>
                <div className={cn('text-xs px-2 py-1 rounded-md border', band.colorClass)}>
                  {currentVal ?? '—'} {currentVal ? `/10 · ${band.band}` : ''}
                </div>
              </div>

              <div className="grid grid-cols-10 gap-1">
                {scores.map((n) => {
                  const selected = currentVal === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={disabled}
                      onClick={() => handlePick(row.key, n)}
                      className={cn(
                        'h-9 rounded-md border text-sm transition-colors',
                        selected ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
                      )}
                      aria-pressed={selected}
                      aria-label={`${row.label} rating ${n}`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => setRatings({ current: null, target: null, projected: null })}
        >
          Clear
        </Button>
        <Button type="button" disabled={disabled || !complete} onClick={submit}>
          Submit ratings
        </Button>
      </div>
    </div>
  );
}

import { PHASE_CONFIGS, ConversationPhase, normalizeConversationPhase } from '@/lib/types/conversation';
import { Check } from 'lucide-react';

interface LensLabel {
  key: string;
  label: string;
}

interface ProgressIndicatorProps {
  currentPhase: string;
  phaseProgress: number;
  includeRegulation?: boolean;
  lensLabels?: LensLabel[] | null;
  phaseElapsedSeconds?: number;
  phaseMaxSeconds?: number;
}

function getIconForPhase(key: string): string {
  const icons: Record<string, string> = {
    people: '👥',
    operations: '⚙️',
    technology: '💻',
    commercial: '📈',
    risk_compliance: '⚖️',
    finance: '💰',
    partners: '🤝',
  };
  return icons[key.toLowerCase()] ?? '📋';
}

export function ProgressIndicator({
  currentPhase,
  phaseProgress,
  includeRegulation = true,
  lensLabels,
  phaseElapsedSeconds = 0,
  phaseMaxSeconds = 300,
}: ProgressIndicatorProps) {
  void includeRegulation;
  const staticAreas = [
    { phase: 'people', name: 'People', icon: '👥' },
    { phase: 'operations', name: 'Operations', icon: '⚙️' },
    { phase: 'technology', name: 'Technology', icon: '💻' },
    { phase: 'commercial', name: 'Commercial', icon: '📈' },
    { phase: 'customer', name: 'Customer', icon: '❤️' },
    { phase: 'risk_compliance', name: 'Risk / Compliance', icon: '⚖️' },
    { phase: 'partners', name: 'Partners', icon: '🤝' },
  ];

  // Use dynamic lens labels when available, otherwise fall back to static areas
  const competencyAreas: Array<{ phase: string; name: string; icon: string }> = lensLabels?.length
    ? lensLabels.map((l) => ({ phase: l.key, name: l.label, icon: getIconForPhase(l.key) }))
    : staticAreas;

  const phaseOrder = ['intro', ...competencyAreas.map((a) => a.phase), 'prioritization', 'summary'];
  const normalizedCurrentPhase = normalizeConversationPhase(currentPhase);

  const getCompletionPercentage = (phase: string): number => {
    const currentIndex = phaseOrder.indexOf(normalizedCurrentPhase);
    const phaseIndex = phaseOrder.indexOf(phase);
    if (phaseIndex === -1) return 0;
    if (currentIndex > phaseIndex) return 100; // Completed
    if (currentIndex === phaseIndex) return phaseProgress; // In progress
    return 0; // Not started
  };

  const isCurrentPhase = (phase: string) => normalizedCurrentPhase === phase;
  const isCompleted = (phase: string) => getCompletionPercentage(phase) === 100;
  const remainingSeconds = Math.max(0, phaseMaxSeconds - phaseElapsedSeconds);
  const timerLabel = `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`;
  const mobileCard = (
    <div className="fixed left-0 right-0 top-0 z-20 lg:hidden border-b bg-white/95 backdrop-blur px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Section Progress</h3>
          <p className="text-xs text-muted-foreground">
            {competencyAreas.length} sections
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Time left</div>
          <div className={`text-sm font-semibold ${remainingSeconds <= 60 ? 'text-red-600' : 'text-slate-700'}`}>
            {timerLabel}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {competencyAreas.map((area) => {
          const percentage = getCompletionPercentage(area.phase);
          const current = isCurrentPhase(area.phase);
          const completed = isCompleted(area.phase);
          return (
            <div key={area.phase} className={`rounded-lg border px-3 py-2 ${current ? 'border-primary bg-primary/5' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-slate-700">{area.icon} {area.name}</span>
                <span className="text-xs font-semibold text-slate-500">{Math.round(percentage)}%</span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full ${completed ? 'bg-green-600' : current ? 'bg-primary' : 'bg-slate-300'}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {mobileCard}
      <div className="fixed right-0 top-0 h-screen w-80 bg-muted/30 border-l p-6 hidden lg:block">
        <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            Discovery Progress
          </h3>
          <p className="text-xs text-muted-foreground">
            {competencyAreas.length} Competency Area{competencyAreas.length !== 1 ? 's' : ''}
          </p>
          <div className="mt-3 rounded-lg border bg-white px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Time left in section</span>
              <span className={`text-sm font-semibold ${remainingSeconds <= 60 ? 'text-red-600' : 'text-slate-700'}`}>
                {timerLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {competencyAreas.map((area) => {
            const percentage = getCompletionPercentage(area.phase);
            const current = isCurrentPhase(area.phase);
            const completed = isCompleted(area.phase);

            return (
              <div key={area.phase} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{area.icon}</span>
                    <span className={`text-sm font-medium ${current ? 'text-primary' : completed ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {area.name}
                    </span>
                    {completed && (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                  <span className={`text-xs ${current ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                    {Math.round(percentage)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      completed ? 'bg-green-600' : current ? 'bg-primary' : 'bg-muted-foreground/20'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                {current && (
                  <p className="text-xs text-muted-foreground">
                    {PHASE_CONFIGS[normalizedCurrentPhase as ConversationPhase]?.objective}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {(normalizedCurrentPhase === 'prioritization' || normalizedCurrentPhase === 'summary') && (
          <div className="pt-4 border-t space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {normalizedCurrentPhase === 'prioritization' ? '📊 Prioritization' : '✅ Summary'}
              </span>
              <span className="text-xs text-primary font-semibold">
                {normalizedCurrentPhase === 'summary' ? '100%' : `${Math.round(phaseProgress)}%`}
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${normalizedCurrentPhase === 'summary' ? 100 : phaseProgress}%` }}
              />
            </div>
          </div>
        )}
        </div>
      </div>
    </>
  );
}

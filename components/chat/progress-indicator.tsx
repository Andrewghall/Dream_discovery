import { PHASE_CONFIGS, ConversationPhase } from '@/lib/types/conversation';
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
}

function getIconForPhase(key: string): string {
  const icons: Record<string, string> = {
    people: '👥',
    corporate: '🏢',
    organisation: '🏢',
    organization: '🏢',
    customer: '🎯',
    technology: '💻',
    regulation: '⚖️',
    finance: '💰',
    operations: '⚙️',
    strategy: '🗺️',
    digital: '🌐',
  };
  return icons[key.toLowerCase()] ?? '📋';
}

export function ProgressIndicator({ currentPhase, phaseProgress, includeRegulation = true, lensLabels }: ProgressIndicatorProps) {
  const staticAreas = [
    { phase: 'people', name: 'People', icon: '👥' },
    { phase: 'corporate', name: 'Organisation', icon: '🏢' },
    { phase: 'customer', name: 'Customer', icon: '🎯' },
    { phase: 'technology', name: 'Technology', icon: '💻' },
    { phase: 'regulation', name: 'Regulation', icon: '⚖️' },
  ];

  // Use dynamic lens labels when available, otherwise fall back to static areas
  const competencyAreas: Array<{ phase: string; name: string; icon: string }> = lensLabels?.length
    ? lensLabels.map((l) => ({ phase: l.key, name: l.label, icon: getIconForPhase(l.key) }))
    : includeRegulation
      ? staticAreas
      : staticAreas.filter((a) => a.phase !== 'regulation');

  const phaseOrder = ['intro', ...competencyAreas.map((a) => a.phase), 'prioritization', 'summary'];

  const getCompletionPercentage = (phase: string): number => {
    const currentIndex = phaseOrder.indexOf(currentPhase);
    const phaseIndex = phaseOrder.indexOf(phase);
    if (phaseIndex === -1) return 0;
    if (currentIndex > phaseIndex) return 100; // Completed
    if (currentIndex === phaseIndex) return phaseProgress; // In progress
    return 0; // Not started
  };

  const isCurrentPhase = (phase: string) => currentPhase === phase;
  const isCompleted = (phase: string) => getCompletionPercentage(phase) === 100;

  return (
    <div className="fixed right-0 top-0 h-screen w-80 bg-muted/30 border-l p-6 hidden lg:block">
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            Discovery Progress
          </h3>
          <p className="text-xs text-muted-foreground">
            {competencyAreas.length} Competency Area{competencyAreas.length !== 1 ? 's' : ''}
          </p>
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
                    {PHASE_CONFIGS[currentPhase]?.objective}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {(currentPhase === 'prioritization' || currentPhase === 'summary') && (
          <div className="pt-4 border-t space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {currentPhase === 'prioritization' ? '📊 Prioritization' : '✅ Summary'}
              </span>
              <span className="text-xs text-primary font-semibold">
                {currentPhase === 'summary' ? '100%' : `${Math.round(phaseProgress)}%`}
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${currentPhase === 'summary' ? 100 : phaseProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

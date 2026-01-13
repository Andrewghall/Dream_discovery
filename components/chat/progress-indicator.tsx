import { Badge } from '@/components/ui/badge';
import { PHASE_CONFIGS, ConversationPhase } from '@/lib/types/conversation';
import { Check } from 'lucide-react';

interface ProgressIndicatorProps {
  currentPhase: ConversationPhase;
  phaseProgress: number;
  includeRegulation?: boolean;
}

export function ProgressIndicator({ currentPhase, phaseProgress, includeRegulation = true }: ProgressIndicatorProps) {
  const baseAreas: Array<{ phase: ConversationPhase; name: string; icon: string }> = [
    { phase: 'people', name: 'People', icon: '👥' },
    { phase: 'corporate', name: 'Corporate', icon: '🏢' },
    { phase: 'customer', name: 'Customer', icon: '🎯' },
    { phase: 'technology', name: 'Technology', icon: '💻' },
    { phase: 'regulation', name: 'Regulation', icon: '⚖️' },
  ];

  const competencyAreas = includeRegulation
    ? baseAreas
    : baseAreas.filter((a) => a.phase !== 'regulation');

  const getCompletionPercentage = (phase: ConversationPhase) => {
    const phases: ConversationPhase[] = includeRegulation
      ? ['intro', 'people', 'corporate', 'customer', 'technology', 'regulation', 'prioritization', 'summary']
      : ['intro', 'people', 'corporate', 'customer', 'technology', 'prioritization', 'summary'];
    const currentIndex = phases.indexOf(currentPhase);
    const phaseIndex = phases.indexOf(phase);
    
    if (currentIndex > phaseIndex) return 100; // Completed
    if (currentIndex === phaseIndex) return phaseProgress; // In progress
    return 0; // Not started
  };

  const isCurrentPhase = (phase: ConversationPhase) => currentPhase === phase;
  const isCompleted = (phase: ConversationPhase) => getCompletionPercentage(phase) === 100;

  return (
    <div className="fixed right-0 top-0 h-screen w-80 bg-muted/30 border-l p-6 hidden lg:block">
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            Discovery Progress
          </h3>
          <p className="text-xs text-muted-foreground">
            5 Competency Areas
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

interface PatternArchetypeCardProps {
  name: string;
  headline?: string;
  insight?: string;
  dreamFocus?: string;
}

export function PatternArchetypeCard({ name, headline, insight, dreamFocus }: PatternArchetypeCardProps) {
  return (
    <div className="bg-[#111111] border border-[#1e1e1e] rounded-2xl p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-48 h-48 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(92,242,142,0.06) 0%, transparent 70%)', transform: 'translate(30%,-30%)' }} />
      <p className="text-[10px] text-[#5cf28e]/60 uppercase tracking-[0.3em] mb-3">Pattern Identified</p>
      <h3 className="text-xl font-black text-white leading-tight mb-3">{name}</h3>
      {headline && <p className="text-white/55 text-sm leading-relaxed mb-3">{headline}</p>}
      {insight && <p className="text-white/30 text-xs leading-relaxed mb-4">{insight}</p>}
      {dreamFocus && (
        <div className="border-t border-white/[0.06] pt-4">
          <p className="text-[10px] text-[#5cf28e]/50 uppercase tracking-[0.2em] mb-1.5">What A DREAM Session Revealed</p>
          <p className="text-xs text-white/40 leading-relaxed">{dreamFocus}</p>
        </div>
      )}
    </div>
  );
}

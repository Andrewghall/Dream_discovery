interface MetricCardProps {
  label: string;
  baseline: string;
  target: string;
  metric?: string;
  colourHex?: string;
}

export function MetricCard({ label, baseline, target, metric, colourHex = '#5cf28e' }: MetricCardProps) {
  return (
    <div className="bg-[#111111] border border-[#1e1e1e] rounded-2xl p-5">
      <p className="text-[10px] uppercase tracking-[0.2em] mb-3" style={{ color: `${colourHex}80` }}>
        {metric ?? label}
      </p>
      <div className="flex items-end gap-3">
        <div>
          <p className="text-[10px] text-white/25 mb-0.5">Now</p>
          <p className="text-lg font-bold text-white/60">{baseline}</p>
        </div>
        <div className="text-white/20 mb-1 text-sm">→</div>
        <div>
          <p className="text-[10px] text-white/25 mb-0.5">Target</p>
          <p className="text-xl font-black" style={{ color: colourHex }}>{target}</p>
        </div>
      </div>
      {metric !== label && (
        <p className="text-xs text-white/30 mt-2 leading-relaxed">{label}</p>
      )}
    </div>
  );
}

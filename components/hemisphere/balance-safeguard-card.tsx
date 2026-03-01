'use client';

import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import type { BalanceSafeguard } from '@/lib/types/hemisphere-diagnostic';

interface BalanceSafeguardCardProps {
  balanceSafeguard: BalanceSafeguard;
}

const SEVERITY_CONFIG = {
  info: { icon: Info, color: '#60a5fa', bg: '#3b82f610', border: '#3b82f620' },
  warning: { icon: AlertTriangle, color: '#fbbf24', bg: '#f59e0b10', border: '#f59e0b20' },
  critical: { icon: AlertTriangle, color: '#f87171', bg: '#ef444410', border: '#ef444420' },
};

export function BalanceSafeguardCard({ balanceSafeguard }: BalanceSafeguardCardProps) {
  const { flags, overallBalance, diagnosis } = balanceSafeguard;

  // Balance gauge colour
  const gaugeColor = overallBalance >= 75 ? '#34d399'
    : overallBalance >= 50 ? '#fbbf24'
    : overallBalance >= 25 ? '#fb923c'
    : '#ef4444';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-white/90 uppercase tracking-wider">Balance Safeguard</h3>
      </div>

      {/* Balance gauge */}
      <div className="flex items-center gap-3">
        <div className="relative w-12 h-12 flex-shrink-0">
          <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="3"
            />
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke={gaugeColor}
              strokeWidth="3"
              strokeDasharray={`${overallBalance}, 100`}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold" style={{ color: gaugeColor }}>
              {overallBalance}
            </span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-slate-300 leading-relaxed">{diagnosis}</p>
        </div>
      </div>

      {/* Flags */}
      {flags.length > 0 ? (
        <div className="space-y-1.5">
          {flags.map((flag, i) => {
            const config = SEVERITY_CONFIG[flag.severity];
            const Icon = config.icon;
            return (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg px-2.5 py-2"
                style={{ backgroundColor: config.bg, borderLeft: `2px solid ${config.border}` }}
              >
                <Icon className="h-3 w-3 flex-shrink-0 mt-0.5" style={{ color: config.color }} />
                <p className="text-[10px] leading-relaxed" style={{ color: config.color }}>
                  {flag.message}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 bg-emerald-500/10 border-l-2 border-emerald-500/20">
          <CheckCircle className="h-3 w-3 text-emerald-400 flex-shrink-0" />
          <p className="text-[10px] text-emerald-400">No imbalance flags detected. Analysis is well-balanced.</p>
        </div>
      )}
    </div>
  );
}

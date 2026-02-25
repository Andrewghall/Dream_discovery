'use client';

import type { Lens, LensCoverage } from '@/lib/cognitive-guidance/pipeline';
import { ALL_LENSES } from '@/lib/cognitive-guidance/pipeline';

const LENS_COLORS: Record<Lens, string> = {
  People: '#a78bfa',
  Organisation: '#f97316',
  Customer: '#60a5fa',
  Technology: '#34d399',
  Regulation: '#fb7185',
};

type Props = {
  coverage: Map<Lens, LensCoverage>;
};

export default function LensCoverageBar({ coverage }: Props) {
  const maxNodes = Math.max(
    1,
    ...ALL_LENSES.map((l) => coverage.get(l)?.nodeCount ?? 0),
  );

  return (
    <div className="flex gap-1 w-full max-h-[60px]">
      {ALL_LENSES.map((lens) => {
        const lc = coverage.get(lens);
        const count = lc?.nodeCount ?? 0;
        const gapScore = lc?.gapScore ?? 0;
        const fillFraction = count / maxNodes;
        const color = LENS_COLORS[lens];
        const isEmpty = count === 0;

        return (
          <div
            key={lens}
            className={`relative flex-1 flex flex-col justify-end rounded-md overflow-hidden ${
              isEmpty ? 'border border-dashed border-gray-400 bg-gray-100' : 'bg-gray-200'
            }`}
            style={{ minHeight: 40, maxHeight: 60 }}
          >
            {/* Colored fill */}
            {!isEmpty && (
              <div
                className="absolute bottom-0 left-0 right-0 rounded-b-md transition-all duration-300"
                style={{
                  height: `${Math.max(fillFraction * 100, 10)}%`,
                  backgroundColor: color,
                  opacity: 0.85,
                }}
              />
            )}

            {/* Label overlay */}
            <div className="relative z-10 flex items-center justify-between px-1.5 py-1">
              <span className="text-[10px] font-medium text-gray-800 leading-tight truncate">
                {lens}
              </span>
              <span className="text-[10px] text-gray-600 tabular-nums ml-1">
                {count}
              </span>
            </div>

            {/* Gap warning */}
            {gapScore > 0.5 && !isEmpty && (
              <div
                className="absolute top-0.5 right-0.5 z-10"
                title={`Gap score: ${(gapScore * 100).toFixed(0)}%`}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 2L1 21h22L12 2z"
                    fill="#f59e0b"
                    stroke="#b45309"
                    strokeWidth="1.5"
                  />
                  <text
                    x="12"
                    y="18"
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="bold"
                    fill="#fff"
                  >
                    !
                  </text>
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

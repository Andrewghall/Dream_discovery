'use client';

import { useState } from 'react';
import { ChevronRight, Play, Pause, Plus, Zap, ZapOff } from 'lucide-react';
import type { GuidedTheme } from '@/lib/cognition/guidance-state';
import type { Lens } from '@/lib/cognitive-guidance/pipeline'; // Lens = string

function LensBadge({ lens, lensColors }: { lens: Lens | null; lensColors?: Record<string, { bg: string; text: string }> }) {
  if (!lens) {
    return (
      <span className="inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
        Cross-cutting
      </span>
    );
  }
  const c = lensColors?.[lens];
  if (c) {
    return (
      <span
        className="inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full border"
        style={{ backgroundColor: c.bg + '33', color: c.text, borderColor: c.bg + '99' }}
      >
        {lens}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
      {lens}
    </span>
  );
}

// ══════════════════════════════════════════════════════════
// PROPS
// ══════════════════════════════════════════════════════════

type ThemeBannerProps = {
  themes: GuidedTheme[];
  activeThemeId: string | null;
  freeflowMode: boolean;
  onAdvanceTheme: () => void;
  onToggleFreeflow: () => void;
  onAddTheme: (title: string) => void;
  lensColors?: Record<string, { bg: string; text: string }>;
};

// ══════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════

export function ThemeBanner({
  themes,
  activeThemeId,
  freeflowMode,
  onAdvanceTheme,
  onToggleFreeflow,
  onAddTheme,
  lensColors,
}: ThemeBannerProps) {
  const [showAddInput, setShowAddInput] = useState(false);
  const [newThemeTitle, setNewThemeTitle] = useState('');

  const activeTheme = themes.find((t) => t.id === activeThemeId);
  const completedCount = themes.filter((t) => t.status === 'completed').length;
  const totalCount = themes.length;
  const queuedThemes = themes.filter((t) => t.status === 'queued');

  const handleAddTheme = () => {
    if (newThemeTitle.trim()) {
      onAddTheme(newThemeTitle.trim());
      setNewThemeTitle('');
      setShowAddInput(false);
    }
  };

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-5 py-3">
        {/* Active theme row */}
        <div className="flex items-center gap-3">
          {/* Theme status indicator */}
          <div className="flex-shrink-0">
            {freeflowMode ? (
              <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center">
                <Pause className="w-4 h-4 text-gray-500" />
              </div>
            ) : activeTheme ? (
              <div className="w-8 h-8 rounded-lg bg-blue-900/40 flex items-center justify-center">
                <Play className="w-4 h-4 text-blue-400" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center">
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </div>
            )}
          </div>

          {/* Theme content */}
          <div className="flex-1 min-w-0">
            {freeflowMode ? (
              <div>
                <p className="text-sm font-medium text-gray-400">Freeflow Mode</p>
                <p className="text-xs text-gray-600">Agents paused — facilitator-led discussion</p>
              </div>
            ) : activeTheme ? (
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-gray-100">{activeTheme.title}</p>
                  <LensBadge lens={activeTheme.lens} lensColors={lensColors} />
                </div>
                <p className="text-xs text-gray-500">{activeTheme.description}</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-400">No active theme</p>
                <p className="text-xs text-gray-600">
                  {queuedThemes.length > 0
                    ? `${queuedThemes.length} theme${queuedThemes.length !== 1 ? 's' : ''} queued — click Next to start`
                    : 'Themes will be suggested as conversation develops'}
                </p>
              </div>
            )}
          </div>

          {/* Progress */}
          <div className="flex-shrink-0 text-xs text-gray-500 font-mono">
            {completedCount}/{totalCount}
          </div>

          {/* Controls */}
          <div className="flex-shrink-0 flex items-center gap-2">
            {/* Next Theme */}
            <button
              onClick={onAdvanceTheme}
              disabled={queuedThemes.length === 0 && !activeTheme}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 transition-colors"
            >
              {activeTheme ? 'Next Theme' : 'Start Theme'}
            </button>

            {/* Freeflow toggle */}
            <button
              onClick={onToggleFreeflow}
              className={`p-1.5 rounded-lg transition-colors ${
                freeflowMode
                  ? 'bg-amber-600/30 text-amber-400 hover:bg-amber-600/40'
                  : 'bg-gray-800 text-gray-400 hover:text-gray-300'
              }`}
              title={freeflowMode ? 'Resume agent guidance' : 'Enter freeflow (pause agents)'}
            >
              {freeflowMode ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
            </button>

            {/* Add theme */}
            <button
              onClick={() => setShowAddInput(!showAddInput)}
              className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-gray-300 transition-colors"
              title="Add custom theme"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Theme queue preview */}
        {queuedThemes.length > 0 && !freeflowMode && (
          <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-[10px] text-gray-600 flex-shrink-0">Queue:</span>
            {queuedThemes.slice(0, 5).map((theme) => (
              <span
                key={theme.id}
                className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full bg-gray-900 text-gray-400 border border-gray-800 flex-shrink-0"
              >
                {theme.lens && (
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: lensColors?.[theme.lens]?.bg || '#374151' }}
                  />
                )}
                {theme.title.length > 30 ? theme.title.substring(0, 30) + '...' : theme.title}
                {theme.source === 'ai' && <span className="text-purple-500">AI</span>}
              </span>
            ))}
            {queuedThemes.length > 5 && (
              <span className="text-[10px] text-gray-600">+{queuedThemes.length - 5} more</span>
            )}
          </div>
        )}

        {/* Add theme input */}
        {showAddInput && (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={newThemeTitle}
              onChange={(e) => setNewThemeTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTheme()}
              placeholder="Theme title..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-600"
              autoFocus
            />
            <button
              onClick={handleAddTheme}
              disabled={!newThemeTitle.trim()}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:text-gray-600 transition-colors"
            >
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

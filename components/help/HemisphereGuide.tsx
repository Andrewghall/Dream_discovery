'use client';

import { useState } from 'react';
import { BookOpen, X, ChevronDown, ChevronUp, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Section {
  title: string;
  content: React.ReactNode;
}

const NODE_TYPES = [
  { color: '#5cf28e', label: 'Vision', desc: 'Aspirational statements — the desired future state. These are opportunities and goals.' },
  { color: '#60a5fa', label: 'Belief', desc: 'Assumptions, mental models, and perspectives participants hold about the current situation.' },
  { color: '#ef4444', label: 'Challenge', desc: 'Friction, pain points, and problems — things that are actively getting in the way.' },
  { color: '#f59e0b', label: 'Friction', desc: 'Specific process or system inefficiencies creating drag (distinct from strategic blockers).' },
  { color: '#a855f7', label: 'Constraint', desc: 'Hard blockers — structural, regulatory, or resource limitations that cannot easily be removed.' },
  { color: '#22d3ee', label: 'Enabler', desc: 'Capabilities, assets, or conditions already in place that can be leveraged for improvement.' },
];

const SECTIONS: Section[] = [
  {
    title: 'What is the Hemisphere?',
    content: (
      <p className="text-sm text-slate-600 leading-relaxed">
        The Hemisphere visualises every insight captured in the workshop as a node in a 3D sphere. Position, colour, and connections reveal the structure of your organisation's thinking — where energy is focused, where tensions exist, and what patterns emerge across participants and topics.
      </p>
    ),
  },
  {
    title: 'Node types — what the colours mean',
    content: (
      <div className="space-y-2.5">
        {NODE_TYPES.map((n) => (
          <div key={n.label} className="flex items-start gap-3">
            <span className="mt-0.5 flex-shrink-0 h-3.5 w-3.5 rounded-full" style={{ backgroundColor: n.color }} />
            <div>
              <span className="text-sm font-medium text-slate-800">{n.label}</span>
              <p className="text-xs text-slate-500 leading-relaxed">{n.desc}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Position in the sphere',
    content: (
      <div className="space-y-2 text-sm text-slate-600 leading-relaxed">
        <p><strong>Centre (white dot):</strong> The gravitational anchor — the most interconnected insight or the strongest signal in the dataset.</p>
        <p><strong>Inner ring:</strong> High-confidence, frequently mentioned ideas — core themes of the conversation.</p>
        <p><strong>Middle band:</strong> Moderately significant insights — supporting evidence and related themes.</p>
        <p><strong>Outer ring:</strong> Emerging ideas, outliers, or single-participant observations. Low confidence but potentially high novelty.</p>
        <p><strong>Hemisphere axis:</strong> Nodes are arranged by lens (use the lens filters on the right to reveal axis positioning).</p>
      </div>
    ),
  },
  {
    title: 'Lenses — the coloured segments',
    content: (
      <div className="space-y-2 text-sm text-slate-600 leading-relaxed">
        <p>Lenses are the strategic dimensions through which your organisation was analysed. Each lens gets its own segment of the sphere and colour-coded dots in the legend.</p>
        <p>Click a lens in the legend to isolate that dimension. Use <strong>All Lenses</strong> to see the full picture. The mini-globes at the bottom show each lens in isolation — useful for spotting which dimensions are data-rich versus thin.</p>
        <p className="text-xs text-slate-400 italic">Lenses are defined by your workshop blueprint. They represent the strategic domains most relevant to your organisation.</p>
      </div>
    ),
  },
  {
    title: 'The Synthesis tab',
    content: (
      <div className="space-y-2 text-sm text-slate-600 leading-relaxed">
        <p>Click <strong>Generate Report</strong> to run AI synthesis. The AI reads every node and produces:</p>
        <ul className="list-disc pl-4 space-y-1 text-xs">
          <li><strong>Executive Summary</strong> — 3–4 paragraph strategic narrative</li>
          <li><strong>Discovery Insights</strong> — Key findings by lens and theme</li>
          <li><strong>Constraints Analysis</strong> — What is blocking progress and why</li>
          <li><strong>Potential Solutions</strong> — AI-generated solution pathways</li>
          <li><strong>Commercial Impact</strong> — Business case and financial framing</li>
          <li><strong>Customer Journey</strong> — Actor-based journey narrative</li>
        </ul>
        <p className="text-xs text-slate-400 mt-1">After synthesis, click <strong>View Output →</strong> to see the full formatted report.</p>
      </div>
    ),
  },
  {
    title: 'The Actors tab',
    content: (
      <p className="text-sm text-slate-600 leading-relaxed">
        Shows every business role or persona mentioned across the workshop. Mention count indicates how frequently each actor was referenced. The AI synthesises key interactions and a journey flow between actors — useful for understanding stakeholder dynamics and pain-point ownership.
      </p>
    ),
  },
  {
    title: 'The Diagnostic tab',
    content: (
      <p className="text-sm text-slate-600 leading-relaxed">
        The Diagnostic tab surfaces structural patterns: contradictions (nodes where participants disagreed), dominant sentiment, lens coverage gaps (areas with few nodes), and signal strength by type. Use this before synthesis to identify where the conversation was shallow and may need follow-up.
      </p>
    ),
  },
  {
    title: 'Snapshot history',
    content: (
      <p className="text-sm text-slate-600 leading-relaxed">
        Each time the live session is saved, a snapshot is recorded. Use the snapshot selector (top bar) to compare the hemisphere at different points in the workshop — for example, before and after a key conversation shift.
      </p>
    ),
  },
];

interface HemisphereGuideProps {
  className?: string;
}

export function HemisphereGuide({ className }: HemisphereGuideProps) {
  const [open, setOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0, 1]));

  const toggleSection = (i: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <>
      {/* Trigger */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn('gap-1.5 text-xs border-white/20 text-white/70 hover:text-white hover:border-white/40 bg-transparent', className)}
      >
        <BookOpen className="h-3.5 w-3.5" />
        How to read this
      </Button>

      {/* Slide-in panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-96 z-50 bg-slate-900 border-l border-white/10 overflow-y-auto shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-white">How to Read the Hemisphere</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white/40 hover:text-white/70 transition-colors"
                aria-label="Close guide"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Sections */}
            <div className="flex-1 overflow-y-auto py-2">
              {SECTIONS.map((section, i) => {
                const isOpen = expandedSections.has(i);
                return (
                  <div key={i} className="border-b border-white/5">
                    <button
                      onClick={() => toggleSection(i)}
                      className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-white/5 transition-colors"
                    >
                      <span className="text-sm font-medium text-white/90">{section.title}</span>
                      {isOpen
                        ? <ChevronUp className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />
                        : <ChevronDown className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />
                      }
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 text-white/70 [&_strong]:text-white/90 [&_p]:text-white/70 [&_li]:text-white/70 [&_span.text-slate-800]:text-white/90 [&_span.text-slate-500]:text-white/50 [&_span.text-slate-600]:text-white/70">
                        {section.content}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-5 py-4 border-t border-white/10 bg-slate-900">
              <p className="text-[11px] text-white/30 leading-relaxed">
                The Hemisphere is generated from live session data. More participants and longer sessions produce denser, more reliable synthesis.
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}

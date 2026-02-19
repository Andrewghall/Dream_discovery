'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { MessageSquare, Users, TrendingUp, Brain } from 'lucide-react';
import { EditableText } from './EditableText';
import { EditableList } from './EditableList';

interface DiscoveryOutputTabProps {
  data: any;
  onChange?: (data: any) => void;
}

const colorMap: Record<string, { border: string; bg: string; text: string; hex: string }> = {
  blue:   { border: 'border-blue-200',   bg: 'bg-blue-50',   text: 'text-blue-600',   hex: '#2563eb' },
  purple: { border: 'border-purple-200', bg: 'bg-purple-50', text: 'text-purple-600', hex: '#9333ea' },
  green:  { border: 'border-green-200',  bg: 'bg-green-50',  text: 'text-green-600',  hex: '#16a34a' },
  orange: { border: 'border-orange-200', bg: 'bg-orange-50', text: 'text-orange-600', hex: '#ea580c' },
  indigo: { border: 'border-indigo-200', bg: 'bg-indigo-50', text: 'text-indigo-600', hex: '#4f46e5' },
  pink:   { border: 'border-pink-200',   bg: 'bg-pink-50',   text: 'text-pink-600',   hex: '#db2777' },
};

/* ── Radar / spider chart (pure SVG, no deps) ────────────────── */

function clampVal(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function RadarChart({ sections }: { sections: any[] }) {
  const size = 500;
  const cx = size / 2;
  const cy = size / 2;
  const padding = 110;
  const radius = (size - padding * 2) / 2;
  const n = sections.length;
  if (n < 3) return null;

  const rings = [0.25, 0.5, 0.75, 1];
  const maxConsensus = 100;

  // Compute angles for each domain
  const points = sections.map((s: any, i: number) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { angle, section: s };
  });

  // Utility: polar to cartesian
  const ptc = (r: number, angle: number) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  });

  // Build polygon points for consensus values
  const consensusPolygon = points.map(({ angle, section }) => {
    const v = Math.min(section.consensusLevel || 0, maxConsensus);
    const r = (v / maxConsensus) * radius;
    return ptc(r, angle);
  });

  // Build polygon points for utterance share (normalised)
  const maxUtt = Math.max(...sections.map((s: any) => s.utteranceCount || 0), 1);
  const uttPolygon = points.map(({ angle, section }) => {
    const v = (section.utteranceCount || 0) / maxUtt;
    const r = v * radius;
    return ptc(r, angle);
  });

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${size} ${size}`}
      className="max-w-lg mx-auto"
      role="img"
      aria-label="Radar chart showing domain coverage and consensus"
    >
      {/* Background rings */}
      {rings.map((t, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={t * radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="1"
        />
      ))}

      {/* Ring labels */}
      {rings.map((t, i) => (
        <text
          key={`rl-${i}`}
          x={cx + 4}
          y={cy - t * radius + 12}
          fontSize="9"
          fill="#9ca3af"
        >
          {Math.round(t * 100)}%
        </text>
      ))}

      {/* Axes */}
      {points.map(({ angle }, i) => {
        const end = ptc(radius, angle);
        return (
          <line
            key={`ax-${i}`}
            x1={cx}
            y1={cy}
            x2={end.x}
            y2={end.y}
            stroke="#d1d5db"
            strokeWidth="1"
          />
        );
      })}

      {/* Utterance volume polygon (fill area) */}
      <polygon
        points={uttPolygon.map(p => `${p.x},${p.y}`).join(' ')}
        fill="#818cf8"
        fillOpacity={0.1}
        stroke="#818cf8"
        strokeWidth="1.5"
        strokeDasharray="4 2"
      />

      {/* Consensus polygon (main filled area) */}
      <polygon
        points={consensusPolygon.map(p => `${p.x},${p.y}`).join(' ')}
        fill="#6366f1"
        fillOpacity={0.25}
        stroke="#6366f1"
        strokeWidth="2"
      />

      {/* Dots on consensus polygon */}
      {consensusPolygon.map((p, i) => (
        <circle key={`cd-${i}`} cx={p.x} cy={p.y} r="5" fill="#6366f1" stroke="white" strokeWidth="2" />
      ))}

      {/* Domain labels — clamped to stay within SVG bounds */}
      {points.map(({ angle, section }, i) => {
        const labelR = radius + 36;
        const lp = ptc(labelR, angle);
        const anchor =
          Math.abs(Math.cos(angle)) < 0.15
            ? 'middle'
            : Math.cos(angle) > 0
            ? 'start'
            : 'end';
        const colors = colorMap[section.color] || colorMap.blue;
        const domainLabel = section.domain || '';
        const subLabel = `${section.consensusLevel || 0}% · ${section.utteranceCount || 0} insights`;
        const longest = Math.max(domainLabel.length, subLabel.length);
        const estWidth = longest * 12 * 0.6;
        const minPad = 6;
        let x = lp.x;
        if (anchor === 'start') {
          x = clampVal(x, minPad, size - estWidth - minPad);
        } else if (anchor === 'end') {
          x = clampVal(x, estWidth + minPad, size - minPad);
        } else {
          x = clampVal(x, estWidth / 2 + minPad, size - estWidth / 2 - minPad);
        }
        const y = clampVal(lp.y, 18, size - minPad);
        return (
          <g key={`lb-${i}`}>
            <text
              x={x}
              y={y - 6}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize="12"
              fontWeight="600"
              fill={colors.hex}
            >
              {domainLabel}
            </text>
            <text
              x={x}
              y={y + 8}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize="10"
              fill="#6b7280"
            >
              {subLabel}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <rect x="10" y={size - 34} width="10" height="10" fill="#6366f1" fillOpacity="0.25" stroke="#6366f1" strokeWidth="1" rx="2" />
      <text x="24" y={size - 25} fontSize="10" fill="#6b7280">Consensus</text>
      <rect x="100" y={size - 34} width="10" height="10" fill="#818cf8" fillOpacity="0.15" stroke="#818cf8" strokeWidth="1" strokeDasharray="3 1" rx="2" />
      <text x="114" y={size - 25} fontSize="10" fill="#6b7280">Insight Volume</text>
    </svg>
  );
}

/* ── Word Cloud (CSS-based, with variety) ─────────────────────── */

const CLOUD_COLORS = [
  '#2563eb', '#9333ea', '#16a34a', '#ea580c', '#4f46e5', '#db2777',
  '#0891b2', '#7c3aed', '#059669', '#d97706', '#6366f1', '#e11d48',
];

function WordCloud({ words, domainColor }: { words: any[]; domainColor?: string }) {
  // Deterministic "random" using word index for rotation and colour
  const items = useMemo(() => {
    if (!words?.length) return [];
    return words.map((w: any, i: number) => {
      const size = Math.min(w.size || 1, 4);
      // Font size: 14px for size 1 → 36px for size 4
      const fontSize = 12 + size * 7;
      const fontWeight = size >= 3 ? 700 : size >= 2 ? 600 : 400;
      // Slight rotation variety: -15° to 15° based on position
      const rotation = ((i * 37) % 7 - 3) * 4;
      // Pick color from palette or use domain color
      const color = domainColor || CLOUD_COLORS[i % CLOUD_COLORS.length];
      const opacity = 0.55 + size * 0.12;
      return { word: w.word, fontSize, fontWeight, rotation, color, opacity };
    });
  }, [words, domainColor]);

  if (!items.length) return null;

  return (
    <div className="bg-white p-6 rounded-lg border">
      <h4 className="font-semibold mb-4">Key Themes</h4>
      <div className="flex flex-wrap gap-x-4 gap-y-2 items-center justify-center min-h-[80px]">
        {items.map((item, i) => (
          <span
            key={i}
            className="inline-block transition-transform hover:scale-110 cursor-default select-none"
            style={{
              fontSize: `${item.fontSize}px`,
              fontWeight: item.fontWeight,
              color: item.color,
              opacity: item.opacity,
              transform: `rotate(${item.rotation}deg)`,
              lineHeight: 1.2,
            }}
          >
            {item.word}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Combined Word Cloud (all domains) ────────────────────────── */

function CombinedWordCloud({ sections }: { sections: any[] }) {
  const allWords = useMemo(() => {
    const merged: { word: string; size: number; color: string }[] = [];
    sections.forEach((s: any) => {
      const colors = colorMap[s.color] || colorMap.blue;
      (s.wordCloud || []).forEach((w: any) => {
        merged.push({ word: w.word, size: w.size, color: colors.hex });
      });
    });
    // Sort by size descending, then shuffle a bit for visual variety
    merged.sort((a, b) => b.size - a.size);
    // Interleave: take big words and spread small ones between them
    const result: typeof merged = [];
    const big = merged.filter(w => w.size >= 3);
    const small = merged.filter(w => w.size < 3);
    let si = 0;
    for (const b of big) {
      result.push(b);
      if (si < small.length) result.push(small[si++]);
      if (si < small.length) result.push(small[si++]);
    }
    while (si < small.length) result.push(small[si++]);
    return result;
  }, [sections]);

  if (!allWords.length) return null;

  return (
    <Card className="p-6 border-2 border-violet-100">
      <h3 className="font-bold text-lg mb-4">Combined Theme Cloud — All Domains</h3>
      <div className="flex flex-wrap gap-x-5 gap-y-2 items-center justify-center min-h-[120px] p-4 bg-gradient-to-br from-slate-50 to-violet-50 rounded-lg">
        {allWords.map((item, i) => {
          const fontSize = 11 + (item.size || 1) * 7;
          const fontWeight = item.size >= 3 ? 700 : item.size >= 2 ? 600 : 400;
          const rotation = ((i * 31) % 9 - 4) * 3;
          const opacity = 0.5 + (item.size || 1) * 0.13;
          return (
            <span
              key={i}
              className="inline-block transition-transform hover:scale-110 cursor-default select-none"
              style={{
                fontSize: `${fontSize}px`,
                fontWeight,
                color: item.color,
                opacity,
                transform: `rotate(${rotation}deg)`,
                lineHeight: 1.2,
              }}
            >
              {item.word}
            </span>
          );
        })}
      </div>
    </Card>
  );
}

/* ── Main Component ───────────────────────────────────────────── */

export function DiscoveryOutputTab({ data, onChange }: DiscoveryOutputTabProps) {
  const update = (fn: (d: any) => void) => {
    if (!onChange) return;
    const clone = JSON.parse(JSON.stringify(data));
    fn(clone);
    onChange(clone);
  };

  if (!data || !data.sections) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No discovery interview data yet. Click &quot;🎯 Load Complete Demo&quot; to populate this tab.
        </p>
      </Card>
    );
  }

  const consensusPercentage = data.sections?.length > 0
    ? Math.round(data.sections.reduce((sum: number, s: any) => sum + (s.consensusLevel || 0), 0) / data.sections.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Discovery Interview Synthesis</h2>
        <p className="text-muted-foreground">
          Synthesized insights from pre-workshop AI discovery conversations with participants. Word clouds, themes, and key utterances organized by domain.
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 border-2 border-blue-100">
          <Users className="h-6 w-6 text-blue-600 mb-2" />
          <div className="text-2xl font-bold text-blue-600">{data.participants?.length || 0}</div>
          <div className="text-sm text-muted-foreground">Participants</div>
        </Card>
        <Card className="p-4 border-2 border-purple-100">
          <MessageSquare className="h-6 w-6 text-purple-600 mb-2" />
          <div className="text-2xl font-bold text-purple-600">{data.totalUtterances || 0}</div>
          <div className="text-sm text-muted-foreground">Insights Captured</div>
        </Card>
        <Card className="p-4 border-2 border-green-100">
          <Brain className="h-6 w-6 text-green-600 mb-2" />
          <div className="text-2xl font-bold text-green-600">{data.sections?.length || 0}</div>
          <div className="text-sm text-muted-foreground">Perspectives</div>
        </Card>
        <Card className="p-4 border-2 border-orange-100">
          <TrendingUp className="h-6 w-6 text-orange-600 mb-2" />
          <div className="text-2xl font-bold text-orange-600">{consensusPercentage}%</div>
          <div className="text-sm text-muted-foreground">Alignment</div>
        </Card>
      </div>

      {/* Spider Diagram - Consensus by Domain */}
      {data.sections?.length >= 3 && (
        <Card className="p-6 border-2 border-indigo-100">
          <h3 className="font-bold text-lg mb-1">Domain Coverage &amp; Consensus</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Radar chart showing consensus alignment and insight volume across all explored domains
          </p>
          <RadarChart sections={data.sections} />
        </Card>
      )}

      {/* Combined Word Cloud */}
      <CombinedWordCloud sections={data.sections || []} />

      {/* Domain Synthesis - Collapsible */}
      <Accordion type="multiple" className="w-full space-y-4">
        <div className="text-xl font-bold mb-2">Themes by Domain</div>

        {data.sections?.map((section: any, idx: number) => {
          const colors = colorMap[section.color] || colorMap.blue;

          return (
            <AccordionItem
              key={idx}
              value={`domain-${idx}`}
              className={`border-2 ${colors.border} ${colors.bg} rounded-lg px-6`}
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-4">
                  <div className="text-4xl">{section.icon}</div>
                  <div className="text-left">
                    <div className="font-bold text-lg">
                      {onChange ? (
                        <EditableText
                          value={section.domain}
                          onChange={(v) => update((d) => { d.sections[idx].domain = v; })}
                          className="font-bold text-lg"
                        />
                      ) : (
                        section.domain
                      )}
                    </div>
                    <div className="text-sm opacity-70">
                      {section.utteranceCount} insights • Top themes:{' '}
                      {onChange ? (
                        <EditableList
                          items={section.topThemes || []}
                          onChange={(items) => update((d) => { d.sections[idx].topThemes = items; })}
                          itemClassName="text-sm opacity-70"
                          addLabel="+ Add theme"
                        />
                      ) : (
                        section.topThemes?.join(', ')
                      )}
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-4">
                  {/* Word Cloud per domain */}
                  {section.wordCloud && (
                    <WordCloud words={section.wordCloud} domainColor={colors.hex} />
                  )}

                  {/* Key Quotes */}
                  {section.quotes && (
                    <div>
                      <h4 className="font-semibold mb-3">Representative Quotes</h4>
                      <div className="space-y-3">
                        {section.quotes.map((quote: any, i: number) => (
                          <Card key={i} className={`p-4 border-l-4 ${colors.border.replace('border-', 'border-l-')} bg-white`}>
                            {onChange ? (
                              <>
                                <p className="text-sm italic mb-2">
                                  &ldquo;
                                  <EditableText
                                    value={quote.text}
                                    onChange={(v) => update((d) => { d.sections[idx].quotes[i].text = v; })}
                                    className="text-sm italic"
                                    multiline
                                  />
                                  &rdquo;
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  —{' '}
                                  <EditableText
                                    value={quote.author}
                                    onChange={(v) => update((d) => { d.sections[idx].quotes[i].author = v; })}
                                    className="text-xs text-muted-foreground"
                                  />
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-sm italic mb-2">&ldquo;{quote.text}&rdquo;</p>
                                <p className="text-xs text-muted-foreground">— {quote.author}</p>
                              </>
                            )}
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sentiment Analysis */}
                  {section.sentiment && (
                    <div className="bg-gradient-to-r from-red-50 via-yellow-50 to-green-50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-2">Sentiment Distribution</h4>
                      <div className="flex items-center gap-0">
                        {section.sentiment.concerned > 0 && (
                          <div
                            className="bg-red-200 h-6 rounded-l"
                            style={{width: `${section.sentiment.concerned}%`}}
                          ></div>
                        )}
                        {section.sentiment.neutral > 0 && (
                          <div
                            className="bg-yellow-200 h-6"
                            style={{width: `${section.sentiment.neutral}%`}}
                          ></div>
                        )}
                        {section.sentiment.optimistic > 0 && (
                          <div
                            className="bg-green-200 h-6 rounded-r"
                            style={{width: `${section.sentiment.optimistic}%`}}
                          ></div>
                        )}
                      </div>
                      <div className="flex justify-between text-xs mt-2 text-muted-foreground">
                        {onChange ? (
                          <>
                            <span>
                              Concerned (
                              <EditableText
                                value={String(section.sentiment.concerned)}
                                onChange={(v) => update((d) => { d.sections[idx].sentiment.concerned = v; })}
                                type="number"
                                className="text-xs text-muted-foreground inline w-12"
                              />
                              %)
                            </span>
                            <span>
                              Neutral (
                              <EditableText
                                value={String(section.sentiment.neutral)}
                                onChange={(v) => update((d) => { d.sections[idx].sentiment.neutral = v; })}
                                type="number"
                                className="text-xs text-muted-foreground inline w-12"
                              />
                              %)
                            </span>
                            <span>
                              Optimistic (
                              <EditableText
                                value={String(section.sentiment.optimistic)}
                                onChange={(v) => update((d) => { d.sections[idx].sentiment.optimistic = v; })}
                                type="number"
                                className="text-xs text-muted-foreground inline w-12"
                              />
                              %)
                            </span>
                          </>
                        ) : (
                          <>
                            <span>Concerned ({section.sentiment.concerned}%)</span>
                            <span>Neutral ({section.sentiment.neutral}%)</span>
                            <span>Optimistic ({section.sentiment.optimistic}%)</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

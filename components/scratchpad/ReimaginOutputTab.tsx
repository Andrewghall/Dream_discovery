import { Fragment, useState } from 'react';
import { Card } from '@/components/ui/card';
import { EditableText } from './EditableText';
import { EditableList } from './EditableList';
import { AiInsightCard } from './AiInsightCard';

interface ReimaginOutputTabProps {
  data: any;
  customerJourney?: any;
  onChange?: (data: any) => void;
}

/* ── Sentiment colours (matches CustomerJourneyTab) ────────────── */

const SENTIMENT_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  positive:  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  neutral:   { bg: 'bg-slate-50',   border: 'border-slate-200',   text: 'text-slate-600',   dot: 'bg-slate-400' },
  concerned: { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  critical:  { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     dot: 'bg-red-400' },
};

/* ── Compact read-only Journey Map ─────────────────────────────── */

function JourneyMapCompact({ journey }: { journey: { stages: string[]; actors: { name: string; role: string }[]; interactions: any[]; painPointSummary?: string; momentOfTruthSummary?: string } }) {
  const painPointCount = journey.interactions.filter((i: any) => i.isPainPoint).length;
  const motCount = journey.interactions.filter((i: any) => i.isMomentOfTruth).length;
  const sentimentCounts = journey.interactions.reduce((acc: Record<string, number>, i: any) => {
    acc[i.sentiment] = (acc[i.sentiment] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="bg-white rounded-2xl p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{journey.stages.length}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Stages</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{journey.actors.length}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Actors</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{journey.interactions.length}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Interactions</div>
          </div>
          {painPointCount > 0 && (
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{painPointCount}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Pain Points</div>
            </div>
          )}
          {motCount > 0 && (
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">{motCount}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Moments of Truth</div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {Object.entries(sentimentCounts).map(([key, count]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${SENTIMENT_COLORS[key]?.dot || 'bg-slate-400'}`} />
              <span className="text-[10px] text-gray-500 capitalize">{key} ({count})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Compact swim-lane grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[900px]"
            style={{
              gridTemplateColumns: `160px repeat(${journey.stages.length}, minmax(140px, 1fr))`,
            }}
          >
            {/* Header row — stages */}
            <div className="bg-slate-50 p-3 border-b border-r border-slate-100" />
            {journey.stages.map((stage: string, idx: number) => (
              <div key={idx} className="bg-slate-50 p-3 border-b border-r border-slate-100 text-center">
                <div className="text-[10px] font-semibold text-gray-900 uppercase tracking-wider">{stage}</div>
              </div>
            ))}

            {/* Actor rows */}
            {journey.actors.map((actor: any, actorIdx: number) => (
              <Fragment key={actorIdx}>
                <div className="bg-slate-50 p-3 border-b border-r border-slate-100">
                  <div className="text-xs font-semibold text-gray-900">{actor.name}</div>
                  <div className="text-[9px] text-gray-400">{actor.role}</div>
                </div>
                {journey.stages.map((stage: string, stageIdx: number) => {
                  const cellInteractions = journey.interactions.filter(
                    (i: any) =>
                      i.actor?.toLowerCase() === actor.name?.toLowerCase() &&
                      i.stage?.toLowerCase() === stage?.toLowerCase()
                  );
                  return (
                    <div key={stageIdx} className="p-1.5 border-b border-r border-slate-100 min-h-[50px]">
                      <div className="space-y-1">
                        {cellInteractions.map((interaction: any, idx: number) => {
                          const style = SENTIMENT_COLORS[interaction.sentiment] || SENTIMENT_COLORS.neutral;
                          return (
                            <div key={idx} className={`relative p-1.5 rounded ${style.bg} ${style.border} border`}>
                              {interaction.isPainPoint && (
                                <span className="absolute -top-1 -left-1 text-[8px]">🔴</span>
                              )}
                              {interaction.isMomentOfTruth && (
                                <span className="absolute -top-1 -right-1 text-[8px]">⭐</span>
                              )}
                              <div className={`text-[9px] font-medium ${style.text} leading-tight`}>
                                {interaction.action}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Pain point + Moment of truth summaries */}
      {(journey.painPointSummary || journey.momentOfTruthSummary) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {journey.painPointSummary && (
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <div className="text-[10px] uppercase tracking-[0.15em] text-red-400 mb-3 font-medium">
                PAIN POINT ANALYSIS
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{journey.painPointSummary}</p>
            </div>
          )}
          {journey.momentOfTruthSummary && (
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <div className="text-[10px] uppercase tracking-[0.15em] text-amber-500 mb-3 font-medium">
                MOMENTS OF TRUTH
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{journey.momentOfTruthSummary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────── */

export function ReimaginOutputTab({ data, customerJourney, onChange }: ReimaginOutputTabProps) {
  const [selectedPrimaryTheme, setSelectedPrimaryTheme] = useState<number | null>(null);
  const [selectedSupportingTheme, setSelectedSupportingTheme] = useState<number | null>(null);

  const update = (fn: (d: any) => void) => {
    if (!onChange) return;
    const clone = JSON.parse(JSON.stringify(data));
    fn(clone);
    onChange(clone);
  };

  if (!data || typeof data !== 'object') {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No reimagine data yet. Click &quot;🎯 Load Complete Demo&quot; to populate this tab.
        </p>
      </Card>
    );
  }

  // Parse customer journey data
  const journeyData =
    customerJourney && typeof customerJourney === 'object'
      ? {
          stages: Array.isArray(customerJourney.stages) ? customerJourney.stages : [],
          actors: Array.isArray(customerJourney.actors) ? customerJourney.actors : [],
          interactions: Array.isArray(customerJourney.interactions) ? customerJourney.interactions : [],
          painPointSummary: customerJourney.painPointSummary || '',
          momentOfTruthSummary: customerJourney.momentOfTruthSummary || '',
        }
      : null;

  const hasJourneyData =
    journeyData && journeyData.stages.length > 0 && journeyData.actors.length > 0;

  return (
    <div className="space-y-12 bg-[#f8f4ec] -mx-8 -my-8 px-8 py-12 min-h-screen">
      {/* AI Executive Insight */}
      {data._aiSummary && <AiInsightCard summary={data._aiSummary} />}

      {/* Title Section - EXACT PAM WELLNESS STYLE */}
      <div className="bg-white rounded-3xl p-16 border-0 shadow-sm">
        <div className="inline-block px-4 py-1.5 rounded-full border border-black/10 text-[10px] uppercase tracking-[0.25em] text-black/40 mb-8 font-medium">
          REIMAGINE OUTPUT
        </div>
        <h1 className="text-7xl font-semibold mb-8 leading-[1.1] text-gray-900">
          <EditableText
            value={data?.reimagineContent?.title || 'Reimagine Output'}
            onChange={(v) => update((d) => { d.reimagineContent.title = v; })}
            className="text-7xl font-semibold leading-[1.1] text-gray-900"
            style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
          />
        </h1>
        <div className="space-y-6 max-w-4xl">
          <div className="text-lg text-gray-700 leading-relaxed">
            <EditableText
              value={data?.reimagineContent?.description || 'The Reimagine session focused on defining the future direction of the business.'}
              onChange={(v) => update((d) => { d.reimagineContent.description = v; })}
              className="text-lg text-gray-700 leading-relaxed"
              multiline
            />
          </div>
          <div className="text-lg text-gray-700 leading-relaxed">
            <EditableText
              value={data?.reimagineContent?.subtitle || 'The conversation explored what must change in the way the business operates and delivers value.'}
              onChange={(v) => update((d) => { d.reimagineContent.subtitle = v; })}
              className="text-lg text-gray-700 leading-relaxed"
              multiline
            />
          </div>
          <p className="text-sm text-gray-500 leading-relaxed italic">
            The themes below are presented in order of importance and emphasis during the session.
          </p>
        </div>
      </div>

      {/* Three Houses */}
      <div>
        <div className="text-xs uppercase tracking-[0.15em] text-[#D4A89A] mb-8 font-medium">
          HOW WE APPROACHED THE REIMAGINE SESSION
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-red-50 rounded-xl overflow-hidden shadow-md border-2 border-red-100">
            <div className="w-full h-48 bg-red-100 flex items-center justify-center overflow-hidden">
              <img src="/framework/house-old.png" alt="The Old House" className="w-full h-full object-contain" />
            </div>
            <div className="p-6 space-y-2">
              <h3 className="font-bold text-lg text-gray-900">The Old House</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                What do we see today? Where are things patched, fragile or overly complex?
              </p>
            </div>
          </div>
          <div className="bg-orange-50 rounded-xl overflow-hidden shadow-md border-2 border-orange-100">
            <div className="w-full h-48 bg-orange-100 flex items-center justify-center overflow-hidden">
              <img src="/framework/house-refreshed.png" alt="The Refreshed House" className="w-full h-full object-contain" />
            </div>
            <div className="p-6 space-y-2">
              <h3 className="font-bold text-lg text-gray-900">The Refreshed House</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                What improves but remains structurally the same?
              </p>
            </div>
          </div>
          <div className="bg-green-50 rounded-xl overflow-hidden shadow-md border-2 border-green-100">
            <div className="w-full h-48 bg-green-100 flex items-center justify-center overflow-hidden">
              <img src="/framework/house-ideal.png" alt="The Ideal House" className="w-full h-full object-contain" />
            </div>
            <div className="p-6 space-y-2">
              <h3 className="font-bold text-lg text-gray-900">The Ideal House</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Ignoring walls and constraints. What would we design from the ground up? What would feel effortless?
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Green Boxes in horizontal row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* First Green Box from supportingSection */}
        {data?.reimagineContent?.supportingSection && (
          <div className="bg-gradient-to-br from-teal-100 to-emerald-100 rounded-2xl p-10 border-2 border-teal-200">
            <h3 className="font-bold text-3xl mb-4 text-gray-900">
              <EditableText
                value={data.reimagineContent.supportingSection.title}
                onChange={(v) => update((d) => { d.reimagineContent.supportingSection.title = v; })}
                className="font-bold text-3xl text-gray-900"
              />
            </h3>
            <div className="text-sm text-gray-800 mb-7 leading-relaxed font-medium">
              <EditableText
                value={data.reimagineContent.supportingSection.description}
                onChange={(v) => update((d) => { d.reimagineContent.supportingSection.description = v; })}
                className="text-sm text-gray-800 leading-relaxed font-medium"
                multiline
              />
            </div>
            <EditableList
              items={data.reimagineContent.supportingSection.points || []}
              onChange={(items) => update((d) => { d.reimagineContent.supportingSection.points = items; })}
              bullet="•"
              bulletClassName="text-teal-700 font-bold text-xl mt-0.5 flex-shrink-0"
              itemClassName="text-sm text-gray-900 leading-relaxed font-medium"
            />
          </div>
        )}

        {/* Accordion sections as green boxes */}
        {data?.reimagineContent?.accordionSections?.map((section: any, index: number) => (
          <div key={index} className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-2xl p-10 border-2 border-teal-200">
            <h3 className="font-bold text-2xl mb-4 text-gray-900">
              <EditableText
                value={section.title}
                onChange={(v) => update((d) => { d.reimagineContent.accordionSections[index].title = v; })}
                className="font-bold text-2xl text-gray-900"
              />
            </h3>
            <div className="text-sm text-gray-800 mb-6 leading-relaxed font-medium">
              <EditableText
                value={section.description}
                onChange={(v) => update((d) => { d.reimagineContent.accordionSections[index].description = v; })}
                className="text-sm text-gray-800 leading-relaxed font-medium"
                multiline
              />
            </div>
            <EditableList
              items={section.points || []}
              onChange={(items) => update((d) => { d.reimagineContent.accordionSections[index].points = items; })}
              bullet="•"
              bulletClassName="text-teal-700 font-bold text-xl mt-0.5 flex-shrink-0"
              itemClassName="text-sm text-gray-900 leading-relaxed font-medium"
            />
          </div>
        ))}
      </div>

      {/* Overall direction of travel */}
      {data?.reimagineContent?.directionOfTravel?.length > 0 && (
        <div>
          <h3 className="font-bold text-3xl mb-2 text-gray-900">Overall direction of travel</h3>
          <p className="text-base text-gray-600 mb-6 leading-relaxed">Taken together, the workshop defined a clear direction:</p>
          <div className="bg-white rounded-2xl p-8 shadow-sm space-y-3">
            {data.reimagineContent.directionOfTravel.map((shift: any, index: number) => (
              <div key={index} className="flex items-center gap-5 p-5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {index + 1}
                </div>
                <span className="text-gray-500 font-medium text-base min-w-0 flex-1 truncate">{shift.from}</span>
                <span className="text-gray-300 flex-shrink-0 text-xl font-light">→</span>
                <span className="text-orange-700 font-bold text-base min-w-0 flex-1 truncate">{shift.to}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 p-5 bg-emerald-50 rounded-xl border border-emerald-200">
            <p className="text-sm text-emerald-800 leading-relaxed">
              This weighted view reflects not just what was discussed, but <strong>what mattered most</strong> during the Reimagine session. It provides a clear guide for what the future model must prioritise as the organisation moves forward.
            </p>
          </div>
        </div>
      )}

      {/* Journey Mapping — compact grid or placeholder */}
      {(data?.reimagineContent?.journeyMapping || hasJourneyData) && (
        <div>
          <h3 className="font-bold text-3xl mb-8 text-gray-900">
            {data?.reimagineContent?.journeyMapping?.title || 'Customer Journey Mapping'}
          </h3>
          {hasJourneyData ? (
            <JourneyMapCompact journey={journeyData!} />
          ) : (
            <div className="p-20 bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl border-2 border-amber-200 text-center">
              <div className="text-8xl mb-6 opacity-30">🗺️</div>
              <h4 className="font-bold text-2xl mb-4 text-gray-900">Journey Mapping</h4>
              <p className="text-base text-gray-700 max-w-2xl mx-auto leading-relaxed">
                Once Journey Mapping is completed, the visual journey timeline will be uploaded here.
                This will show the step-by-step transformation journey with key touchpoints and stages.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Primary Themes + Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl p-10 shadow-sm">
            <h3 className="font-bold text-3xl mb-8 text-gray-900">Primary themes</h3>
            <div className="space-y-5">
            {data?.reimagineContent?.primaryThemes?.map((theme: any, index: number) => {
              const badgePill =
                theme.badge === 'very high' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                theme.badge === 'high'      ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                              'bg-slate-100 text-slate-500 border border-slate-200';
              return (
              <div
                key={index}
                className={`p-6 border-l-[6px] rounded-lg cursor-pointer transition-all duration-200 ${
                  selectedPrimaryTheme === index
                    ? 'border-orange-700 bg-orange-50 ring-2 ring-orange-300 shadow-md'
                    : 'border-orange-700 bg-gray-50 hover:bg-orange-50/50 hover:shadow-sm'
                }`}
                onMouseDown={() => setSelectedPrimaryTheme(selectedPrimaryTheme === index ? null : index)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-base flex-shrink-0 ${
                      selectedPrimaryTheme === index ? 'bg-orange-800 scale-110' : 'bg-orange-700'
                    } transition-all duration-200`}>{index + 1}</div>
                    <div className="flex-1">
                      <span className="font-semibold text-gray-900 text-lg block mb-1">
                        <EditableText
                          value={theme.title}
                          onChange={(v) => update((d) => { d.reimagineContent.primaryThemes[index].title = v; })}
                          className="font-semibold text-gray-900 text-lg"
                        />
                      </span>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize flex-shrink-0 ${badgePill}`}>
                    {theme.badge || 'high'}
                  </span>
                </div>
              </div>
              );
            }) || (
              <div className="text-gray-500 italic">No primary themes defined yet</div>
            )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 lg:sticky lg:top-8 lg:self-start">
          {(() => {
            const pt = selectedPrimaryTheme;
            const theme = pt !== null ? data?.reimagineContent?.primaryThemes?.[pt] : null;

            if (theme) {
              // Show selected theme details
              return (
                <div className="bg-white rounded-2xl border-2 border-amber-300 shadow-md overflow-hidden flex flex-col animate-in fade-in duration-200">
                  <div className="p-8 bg-gradient-to-br from-amber-100 via-orange-100 to-amber-200">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-700 text-white flex items-center justify-center font-bold">{pt! + 1}</div>
                        <div className="text-xs uppercase tracking-[0.15em] text-amber-900 font-bold">
                          {theme.badge ? `${theme.badge} weighting` : 'THEME'}
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedPrimaryTheme(null)}
                        className="text-amber-800 hover:text-amber-950 text-sm font-medium px-2 py-1 rounded hover:bg-amber-200/50 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                    <h4 className="font-bold text-2xl text-gray-900 leading-tight">
                      {theme.title}
                    </h4>
                  </div>
                  <div className="p-8 flex-1 space-y-5">
                    <div className="text-sm text-gray-700 leading-relaxed">
                      <EditableText
                        value={theme.description || 'Click to add a description for this theme...'}
                        onChange={(v) => update((d) => { d.reimagineContent.primaryThemes[pt!].description = v; })}
                        className="text-sm text-gray-700 leading-relaxed"
                        multiline
                      />
                    </div>
                    {/* Named sub-sections */}
                    {theme.subSections?.length > 0 && (
                      <div className="space-y-3">
                        {theme.subSections.map((sub: any, si: number) => (
                          <div key={si} className="bg-emerald-50 rounded-xl p-5 border border-emerald-100">
                            <p className="font-semibold text-sm text-gray-900 mb-2">{sub.title}</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{sub.description}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Supporting detail points */}
                    <div className="text-sm text-gray-700 leading-relaxed font-medium">
                      {(theme.details?.length > 0) && (
                        <EditableList
                          items={theme.details}
                          onChange={(items) => update((d) => { d.reimagineContent.primaryThemes[pt!].details = items; })}
                          bullet="•"
                          bulletClassName="text-gray-400 font-medium mt-0.5 flex-shrink-0"
                          itemClassName="text-sm text-gray-700 leading-relaxed"
                          addLabel="+ Add detail"
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            // Default: show SHIFT ONE
            return (
              <div className="bg-white rounded-2xl border-2 border-amber-300 shadow-md overflow-hidden flex flex-col">
                <div className="p-8 bg-gradient-to-br from-amber-100 via-orange-100 to-amber-200">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-full bg-amber-700 text-white flex items-center justify-center font-bold">1</div>
                    <div className="text-xs uppercase tracking-[0.15em] text-amber-900 font-bold">SHIFT ONE</div>
                  </div>
                  <h4 className="font-bold text-2xl text-gray-900 leading-tight">
                    <EditableText
                      value={data?.reimagineContent?.shiftOne?.title || 'First Key Shift'}
                      onChange={(v) => update((d) => { d.reimagineContent.shiftOne.title = v; })}
                      className="font-bold text-2xl text-gray-900 leading-tight"
                    />
                  </h4>
                </div>
                <div className="p-8 flex-1">
                  <div className="text-sm text-gray-800 mb-5 leading-relaxed font-medium">
                    <EditableText
                      value={data?.reimagineContent?.shiftOne?.description || 'Description of the first major shift or transformation theme from the reimagine session.'}
                      onChange={(v) => update((d) => { d.reimagineContent.shiftOne.description = v; })}
                      className="text-sm text-gray-800 leading-relaxed font-medium"
                      multiline
                    />
                  </div>
                  <div className="text-sm text-gray-700 leading-relaxed font-medium">
                    {data?.reimagineContent?.shiftOne?.details?.length > 0 ? (
                      <EditableList
                        items={data.reimagineContent.shiftOne.details}
                        onChange={(items) => update((d) => { d.reimagineContent.shiftOne.details = items; })}
                        bullet="•"
                        bulletClassName="text-gray-700 font-medium mt-0.5 flex-shrink-0"
                        itemClassName="text-sm text-gray-700 leading-relaxed font-medium"
                      />
                    ) : (
                      <div className="space-y-3">
                        <p>• Key detail point one</p>
                        <p>• Key detail point two</p>
                        <p>• Key detail point three</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Supporting Themes + Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl p-10 shadow-sm">
            <h3 className="font-bold text-3xl mb-8 text-gray-900">Supporting themes</h3>
            <div className="space-y-5">
            {data?.reimagineContent?.supportingThemes?.map((theme: any, index: number) => {
              const primaryCount = data?.reimagineContent?.primaryThemes?.length ?? 5;
              const absoluteNum = primaryCount + index + 1;
              return (
              <div
                key={index}
                className={`p-6 border-l-[6px] rounded-lg cursor-pointer transition-all duration-200 ${
                  selectedSupportingTheme === index
                    ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-300 shadow-md'
                    : 'border-sky-500 bg-gray-50 hover:bg-sky-50/50 hover:shadow-sm'
                }`}
                onMouseDown={() => setSelectedSupportingTheme(selectedSupportingTheme === index ? null : index)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-base flex-shrink-0 ${
                      selectedSupportingTheme === index ? 'bg-sky-600 scale-110' : 'bg-sky-500'
                    } transition-all duration-200`}>{absoluteNum}</div>
                    <div className="flex-1">
                      <span className="font-semibold text-gray-900 text-lg block mb-1">
                        <EditableText
                          value={theme.title}
                          onChange={(v) => update((d) => { d.reimagineContent.supportingThemes[index].title = v; })}
                          className="font-semibold text-gray-900 text-lg"
                        />
                      </span>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold capitalize flex-shrink-0 bg-slate-100 text-slate-500 border border-slate-200">
                    medium
                  </span>
                </div>
              </div>
              );
            }) || (
              <div className="text-gray-500 italic">No supporting themes defined yet</div>
            )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 lg:sticky lg:top-8 lg:self-start">
          {(() => {
            const st = selectedSupportingTheme;
            const theme = st !== null ? data?.reimagineContent?.supportingThemes?.[st] : null;

            if (theme) {
              // Show selected theme details
              return (
                <div className="bg-white rounded-2xl border-2 border-sky-300 shadow-md overflow-hidden flex flex-col animate-in fade-in duration-200">
                  <div className="p-8 bg-gradient-to-br from-sky-100 via-blue-100 to-indigo-200">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-sky-700 text-white flex items-center justify-center font-bold">
                          {(data?.reimagineContent?.primaryThemes?.length ?? 5) + st! + 1}
                        </div>
                        <div className="text-xs uppercase tracking-[0.15em] text-sky-900 font-bold">
                          medium weighting
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedSupportingTheme(null)}
                        className="text-sky-800 hover:text-sky-950 text-sm font-medium px-2 py-1 rounded hover:bg-sky-200/50 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                    <h4 className="font-bold text-2xl text-gray-900 leading-tight">
                      {theme.title}
                    </h4>
                  </div>
                  <div className="p-8 flex-1 space-y-5">
                    <div className="text-sm text-gray-700 leading-relaxed">
                      <EditableText
                        value={theme.description || 'Click to add a description for this theme...'}
                        onChange={(v) => update((d) => { d.reimagineContent.supportingThemes[st!].description = v; })}
                        className="text-sm text-gray-700 leading-relaxed"
                        multiline
                      />
                    </div>
                    {/* Named sub-sections */}
                    {theme.subSections?.length > 0 && (
                      <div className="space-y-3">
                        {theme.subSections.map((sub: any, si: number) => (
                          <div key={si} className="bg-sky-50 rounded-xl p-5 border border-sky-100">
                            <p className="font-semibold text-sm text-gray-900 mb-2">{sub.title}</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{sub.description}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {theme.details?.length > 0 && (
                      <EditableList
                        items={theme.details}
                        onChange={(items) => update((d) => { d.reimagineContent.supportingThemes[st!].details = items; })}
                        bullet="•"
                        bulletClassName="text-gray-400 font-medium mt-0.5 flex-shrink-0"
                        itemClassName="text-sm text-gray-700 leading-relaxed"
                        addLabel="+ Add detail"
                      />
                    )}
                  </div>
                </div>
              );
            }

            // Default: show SHIFT TWO
            return (
              <div className="bg-white rounded-2xl border-2 border-sky-300 shadow-md overflow-hidden flex flex-col">
                <div className="p-8 bg-gradient-to-br from-sky-100 via-blue-100 to-indigo-200">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-full bg-sky-700 text-white flex items-center justify-center font-bold">2</div>
                    <div className="text-xs uppercase tracking-[0.15em] text-sky-900 font-bold">SHIFT TWO</div>
                  </div>
                  <h4 className="font-bold text-2xl text-gray-900 leading-tight">
                    <EditableText
                      value={data?.reimagineContent?.shiftTwo?.title || 'Second Key Shift'}
                      onChange={(v) => update((d) => { d.reimagineContent.shiftTwo.title = v; })}
                      className="font-bold text-2xl text-gray-900 leading-tight"
                    />
                  </h4>
                </div>
                <div className="p-8 flex-1">
                  <div className="text-sm text-gray-800 mb-5 leading-relaxed font-medium">
                    <EditableText
                      value={data?.reimagineContent?.shiftTwo?.description || 'Description of the second major shift or transformation theme from the reimagine session.'}
                      onChange={(v) => update((d) => { d.reimagineContent.shiftTwo.description = v; })}
                      className="text-sm text-gray-800 leading-relaxed font-medium"
                      multiline
                    />
                  </div>
                  <div className="text-sm text-gray-700 leading-relaxed font-medium">
                    {data?.reimagineContent?.shiftTwo?.details?.length > 0 ? (
                      <EditableList
                        items={data.reimagineContent.shiftTwo.details}
                        onChange={(items) => update((d) => { d.reimagineContent.shiftTwo.details = items; })}
                        bullet="•"
                        bulletClassName="text-gray-700 font-medium mt-0.5 flex-shrink-0"
                        itemClassName="text-sm text-gray-700 leading-relaxed font-medium"
                      />
                    ) : (
                      <div className="space-y-3">
                        <p>• Key detail point one</p>
                        <p>• Key detail point two</p>
                        <p>• Key detail point three</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Platform Vision Alignment */}
      {data?.reimagineContent?.visionAlignment && (
        <div className="bg-white rounded-2xl p-10 shadow-sm">
          <h3 className="font-bold text-3xl mb-3 text-gray-900">Platform Vision Alignment</h3>
          <p className="text-base text-gray-600 mb-8 leading-relaxed">
            {data.reimagineContent.visionAlignment.context || 'The workshop confirmed that the future model must:'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-8 rounded-xl border border-gray-100 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-5">Core Principles</p>
              <ul className="space-y-3">
                {(data.reimagineContent.visionAlignment.corePrinciples ?? []).map((p: string, i: number) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-emerald-800 leading-relaxed">
                    <span className="text-emerald-400 flex-shrink-0 mt-0.5 font-bold">•</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-8 rounded-xl border border-blue-100 bg-blue-50">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-5">Platform Position</p>
              <ul className="space-y-3">
                {(data.reimagineContent.visionAlignment.platformPosition ?? []).map((p: string, i: number) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-blue-900 leading-relaxed">
                    <span className="text-blue-400 flex-shrink-0 mt-0.5 font-bold">•</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Horizon Vision Alignment */}
      <div>
        <h3 className="font-bold text-3xl mb-8 text-gray-900">
          <EditableText
            value={data?.reimagineContent?.horizonVision?.title || 'Horizon Vision Alignment'}
            onChange={(v) => update((d) => { d.reimagineContent.horizonVision.title = v; })}
            className="font-bold text-3xl text-gray-900"
          />
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {data?.reimagineContent?.horizonVision?.columns?.length > 0 ? (
            data.reimagineContent.horizonVision.columns.map((column: any, index: number) => (
              <div key={index} className="p-10 bg-white rounded-2xl shadow-md">
                <h4 className="font-bold text-xl mb-6 text-gray-900">
                  <EditableText
                    value={column.title}
                    onChange={(v) => update((d) => { d.reimagineContent.horizonVision.columns[index].title = v; })}
                    className="font-bold text-xl text-gray-900"
                  />
                </h4>
                <EditableList
                  items={column.points || []}
                  onChange={(items) => update((d) => { d.reimagineContent.horizonVision.columns[index].points = items; })}
                  bullet="•"
                  bulletClassName="text-gray-400 font-bold text-xl mt-0.5 flex-shrink-0"
                  itemClassName="text-sm text-gray-800 leading-relaxed font-medium"
                />
              </div>
            ))
          ) : (
            <>
              <div className="p-10 bg-white rounded-2xl shadow-md">
                <h4 className="font-bold text-xl mb-6 text-gray-900">Horizon 1: Foundation (Months 1-6)</h4>
                <ul className="space-y-4">
                  <li className="flex items-start gap-4">
                    <span className="text-gray-400 font-bold text-xl mt-0.5">•</span>
                    <span className="text-sm text-gray-800 leading-relaxed font-medium">
                      First foundational initiative
                    </span>
                  </li>
                  <li className="flex items-start gap-4">
                    <span className="text-gray-400 font-bold text-xl mt-0.5">•</span>
                    <span className="text-sm text-gray-800 leading-relaxed font-medium">
                      Second foundational initiative
                    </span>
                  </li>
                </ul>
              </div>
              <div className="p-10 bg-white rounded-2xl shadow-md">
                <h4 className="font-bold text-xl mb-6 text-gray-900">Horizon 2: Transformation (Months 6-18)</h4>
                <ul className="space-y-4">
                  <li className="flex items-start gap-4">
                    <span className="text-gray-400 font-bold text-xl mt-0.5">•</span>
                    <span className="text-sm text-gray-800 leading-relaxed font-medium">
                      First transformation initiative
                    </span>
                  </li>
                  <li className="flex items-start gap-4">
                    <span className="text-gray-400 font-bold text-xl mt-0.5">•</span>
                    <span className="text-sm text-gray-800 leading-relaxed font-medium">
                      Second transformation initiative
                    </span>
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { Card } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PoundSterling, TrendingUp, Calendar, AlertTriangle } from 'lucide-react';
import { EditableText } from './EditableText';
import { EditableList } from './EditableList';
import { AiInsightCard } from './AiInsightCard';

interface CommercialTabProps {
  data: any;
  onChange?: (data: any) => void;
}

export function CommercialTab({ data, onChange }: CommercialTabProps) {
  if (!data || typeof data !== 'object') {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No commercial data yet. Click "🎯 Load Complete Demo" to populate this tab.
        </p>
      </Card>
    );
  }

  const update = (fn: (d: any) => void) => {
    if (!onChange) return;
    const clone = JSON.parse(JSON.stringify(data));
    fn(clone);
    onChange(clone);
  };

  return (
    <div className="space-y-6">
      {/* AI Executive Insight */}
      {data._aiSummary && <AiInsightCard summary={data._aiSummary} />}

      <div>
        <h2 className="text-2xl font-bold mb-2">Commercial Approach</h2>
        <p className="text-muted-foreground">
          Investment summary, delivery phases, and commercial model.
        </p>
      </div>

      {/* Investment Summary - Always Visible */}
      {data.investmentSummary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6 text-center border-2 border-blue-100 bg-blue-50">
            <PoundSterling className="h-8 w-8 mx-auto mb-2 text-blue-600" />
            <div className="text-3xl font-bold text-blue-600">
              <EditableText
                value={data.investmentSummary.totalInvestment}
                onChange={(v) => update((d) => { d.investmentSummary.totalInvestment = v; })}
                className="text-3xl font-bold text-blue-600"
              />
            </div>
            <div className="text-sm text-muted-foreground">Total Investment</div>
          </Card>
          <Card className="p-6 text-center border-2 border-green-100 bg-green-50">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-600" />
            <div className="text-3xl font-bold text-green-600">
              <EditableText
                value={data.investmentSummary.fiveYearROI}
                onChange={(v) => update((d) => { d.investmentSummary.fiveYearROI = v; })}
                className="text-3xl font-bold text-green-600"
              />
            </div>
            <div className="text-sm text-muted-foreground">5-Year ROI</div>
          </Card>
          <Card className="p-6 text-center border-2 border-orange-100 bg-orange-50">
            <Calendar className="h-8 w-8 mx-auto mb-2 text-orange-600" />
            <div className="text-3xl font-bold text-orange-600">
              <EditableText
                value={data.investmentSummary.paybackPeriod}
                onChange={(v) => update((d) => { d.investmentSummary.paybackPeriod = v; })}
                className="text-3xl font-bold text-orange-600"
              />
            </div>
            <div className="text-sm text-muted-foreground">Payback Period</div>
          </Card>
          <Card className="p-6 text-center border-2 border-purple-100 bg-purple-50">
            <PoundSterling className="h-8 w-8 mx-auto mb-2 text-purple-600" />
            <div className="text-3xl font-bold text-purple-600">
              <EditableText
                value={data.investmentSummary.annualSavings}
                onChange={(v) => update((d) => { d.investmentSummary.annualSavings = v; })}
                className="text-3xl font-bold text-purple-600"
              />
            </div>
            <div className="text-sm text-muted-foreground">Annual Savings</div>
          </Card>
        </div>
      )}

      {/* Delivery Phases - Collapsible */}
      {data.deliveryPhases && (
        <Accordion type="single" collapsible className="w-full space-y-4">
          <div className="text-xl font-bold mb-2">Delivery Phases</div>
          {data.deliveryPhases.map((phase: any, idx: number) => (
            <AccordionItem
              key={idx}
              value={`phase-${idx}`}
              className="border-2 border-indigo-200 bg-indigo-50 rounded-lg px-6"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-4 text-left">
                  <div className="text-3xl">{idx === 0 ? '🚀' : idx === 1 ? '⚡' : '🎯'}</div>
                  <div>
                    <div className="font-bold">
                      <EditableText
                        value={phase.phase}
                        onChange={(v) => update((d) => { d.deliveryPhases[idx].phase = v; })}
                        className="font-bold"
                      />
                    </div>
                    <div className="text-sm opacity-70 flex gap-3">
                      <EditableText
                        value={phase.duration}
                        onChange={(v) => update((d) => { d.deliveryPhases[idx].duration = v; })}
                        className="text-sm"
                      />
                      <span>•</span>
                      <EditableText
                        value={phase.investment}
                        onChange={(v) => update((d) => { d.deliveryPhases[idx].investment = v; })}
                        className="text-sm font-semibold text-indigo-900"
                      />
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-4">
                  {/* Scope */}
                  <div>
                    <h4 className="font-semibold mb-2">Scope</h4>
                    <EditableList
                      items={phase.scope}
                      onChange={(items) => update((d) => { d.deliveryPhases[idx].scope = items; })}
                      bullet="▸"
                      bulletClassName="text-indigo-600 flex-shrink-0"
                      itemClassName="text-sm"
                      addLabel="+ Add scope item"
                    />
                  </div>

                  {/* Outcomes */}
                  <div className="bg-green-50 border-l-4 border-green-400 p-4">
                    <h4 className="font-semibold text-green-900 mb-2">Expected Outcomes</h4>
                    <EditableList
                      items={phase.outcomes}
                      onChange={(items) => update((d) => { d.deliveryPhases[idx].outcomes = items; })}
                      bullet="✓"
                      bulletClassName="text-green-600 flex-shrink-0"
                      itemClassName="text-sm text-green-800"
                      addLabel="+ Add outcome"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Risk Assessment - Collapsible */}
      {data.riskAssessment && (
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="risks" className="border-2 border-red-200 bg-red-50 rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-4">
                <AlertTriangle className="h-8 w-8 text-red-600" />
                <div className="text-left">
                  <div className="font-bold text-lg">Risk Assessment</div>
                  <div className="text-sm opacity-70">{data.riskAssessment.length} identified risks</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-4">
                {data.riskAssessment.map((risk: any, idx: number) => (
                  <Card key={idx} className="p-4 border-2 border-red-100">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-semibold flex-1">
                        <EditableText
                          value={risk.risk}
                          onChange={(v) => update((d) => { d.riskAssessment[idx].risk = v; })}
                          className="font-semibold"
                        />
                      </h4>
                      <div className="flex gap-2">
                        <span className="text-xs px-2 py-1 rounded border bg-orange-100 text-orange-800 border-orange-300">
                          <EditableText
                            value={risk.probability}
                            onChange={(v) => update((d) => { d.riskAssessment[idx].probability = v; })}
                            className="text-xs"
                          />
                        </span>
                        <span className={`text-xs px-2 py-1 rounded border ${
                          risk.impact === 'Critical'
                            ? 'bg-red-100 text-red-800 border-red-300'
                            : 'bg-orange-100 text-orange-800 border-orange-300'
                        }`}>
                          <EditableText
                            value={risk.impact}
                            onChange={(v) => update((d) => { d.riskAssessment[idx].impact = v; })}
                            className="text-xs"
                          />
                        </span>
                      </div>
                    </div>
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-3">
                      <p className="text-sm font-medium text-blue-900">Mitigation:</p>
                      <EditableText
                        value={risk.mitigation}
                        onChange={(v) => update((d) => { d.riskAssessment[idx].mitigation = v; })}
                        className="text-sm text-blue-800"
                        multiline
                      />
                    </div>
                  </Card>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}

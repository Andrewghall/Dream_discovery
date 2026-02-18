'use client';

import { Card } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Lightbulb, CheckCircle2, Target, Calendar } from 'lucide-react';
import { EditableText } from './EditableText';
import { EditableList } from './EditableList';

interface SummaryTabProps {
  data: any;
  onChange?: (data: any) => void;
}

export function SummaryTab({ data, onChange }: SummaryTabProps) {
  if (!data || typeof data !== 'object') {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No summary data yet. Click "🎯 Load Complete Demo" to populate this tab.
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
      <div>
        <h2 className="text-2xl font-bold mb-2">Executive Summary & Next Steps</h2>
        <p className="text-muted-foreground">
          Key findings, recommended actions, and success metrics.
        </p>
      </div>

      {/* Key Findings - Collapsible by Category */}
      {data.keyFindings && (
        <Accordion type="multiple" className="w-full space-y-4">
          <div className="text-xl font-bold mb-2">Key Findings</div>
          {data.keyFindings.map((category: any, idx: number) => (
            <AccordionItem
              key={idx}
              value={`finding-${idx}`}
              className="border-2 border-blue-200 bg-blue-50 rounded-lg px-6"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-4">
                  <Lightbulb className="h-8 w-8 text-blue-600" />
                  <div className="text-left">
                    <div className="font-bold text-lg">
                      <EditableText
                        value={category.category}
                        onChange={(v) => update((d) => { d.keyFindings[idx].category = v; })}
                        className="font-bold text-lg"
                      />
                    </div>
                    <div className="text-sm opacity-70">{category.findings.length} key insights</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-4">
                  <EditableList
                    items={category.findings}
                    onChange={(items) => update((d) => { d.keyFindings[idx].findings = items; })}
                    bullet="✓"
                    bulletClassName="text-blue-600 flex-shrink-0 mt-0.5"
                    itemClassName="text-sm leading-relaxed"
                    addLabel="+ Add finding"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Recommended Next Steps - Collapsible */}
      {data.recommendedNextSteps && (
        <Accordion type="single" collapsible defaultValue="next-steps" className="w-full">
          <AccordionItem value="next-steps" className="border-2 border-green-200 bg-green-50 rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-4">
                <Calendar className="h-8 w-8 text-green-600" />
                <div className="text-left">
                  <div className="font-bold text-lg">Recommended Next Steps</div>
                  <div className="text-sm opacity-70">Priority actions with timeline</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-4">
                {data.recommendedNextSteps.map((step: any, idx: number) => (
                  <Card key={idx} className="p-4 border-2 border-green-100">
                    <div className="flex items-start gap-4">
                      <div className="text-3xl">{idx === 0 ? '1️⃣' : idx === 1 ? '2️⃣' : idx === 2 ? '3️⃣' : '4️⃣'}</div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-lg">
                            <EditableText
                              value={step.step}
                              onChange={(v) => update((d) => { d.recommendedNextSteps[idx].step = v; })}
                              className="font-semibold text-lg"
                            />
                          </h4>
                          <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800 border border-green-300">
                            <EditableText
                              value={step.timeframe}
                              onChange={(v) => update((d) => { d.recommendedNextSteps[idx].timeframe = v; })}
                              className="text-xs"
                            />
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          Owner: <EditableText
                            value={step.owner}
                            onChange={(v) => update((d) => { d.recommendedNextSteps[idx].owner = v; })}
                            className="text-sm"
                          />
                        </p>
                        <EditableList
                          items={step.actions}
                          onChange={(items) => update((d) => { d.recommendedNextSteps[idx].actions = items; })}
                          bullet="▸"
                          bulletClassName="text-green-600 flex-shrink-0"
                          itemClassName="text-sm"
                          addLabel="+ Add action"
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* Success Metrics */}
      {data.successMetrics && (
        <div>
          <h3 className="text-xl font-bold mb-4">Success Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.successMetrics.map((metric: any, idx: number) => (
              <Card key={idx} className="p-4 border-2 border-indigo-100 bg-indigo-50">
                <div className="flex items-start gap-3">
                  <Target className="h-6 w-6 text-indigo-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-indigo-900 mb-2">
                      <EditableText
                        value={metric.metric}
                        onChange={(v) => update((d) => { d.successMetrics[idx].metric = v; })}
                        className="font-semibold text-indigo-900"
                      />
                    </h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Baseline:</span>
                        <EditableText
                          value={metric.baseline}
                          onChange={(v) => update((d) => { d.successMetrics[idx].baseline = v; })}
                          className="font-medium text-sm"
                        />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Target:</span>
                        <EditableText
                          value={metric.target}
                          onChange={(v) => update((d) => { d.successMetrics[idx].target = v; })}
                          className="font-medium text-green-700 text-sm"
                        />
                      </div>
                      <div className="text-xs text-muted-foreground pt-1 border-t">
                        <EditableText
                          value={metric.measurement}
                          onChange={(v) => update((d) => { d.successMetrics[idx].measurement = v; })}
                          className="text-xs text-muted-foreground"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

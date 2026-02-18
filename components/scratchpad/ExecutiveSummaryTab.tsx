'use client';

import { Card } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { TrendingUp, Users, Lightbulb, Target } from 'lucide-react';
import { EditableText } from './EditableText';

interface ExecutiveSummaryTabProps {
  data: any;
  onChange?: (data: any) => void;
}

export function ExecutiveSummaryTab({ data, onChange }: ExecutiveSummaryTabProps) {
  if (!data || typeof data !== 'object') {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No executive summary data yet. Click &quot;🎯 Load Complete Demo&quot; to populate this tab.
        </p>
      </Card>
    );
  }

  const update = (field: string, value: any) => {
    if (!onChange) return;
    onChange({ ...data, [field]: value });
  };

  const updateMetric = (field: string, value: number) => {
    if (!onChange) return;
    onChange({ ...data, metrics: { ...data.metrics, [field]: value } });
  };

  const updateFinding = (idx: number, field: string, value: string) => {
    if (!onChange) return;
    const keyFindings = data.keyFindings.map((f: any, i: number) =>
      i === idx ? { ...f, [field]: value } : f
    );
    onChange({ ...data, keyFindings });
  };

  return (
    <div className="space-y-6">
      {/* Hero Card - Executive Summary */}
      <Card className="p-8 bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0">
        <h2 className="text-3xl font-bold mb-3">Executive Summary</h2>
        <EditableText
          value={data.overview || ''}
          onChange={(v) => update('overview', v)}
          className="text-lg leading-relaxed opacity-95"
          inputClassName="!text-white !bg-white/20 !border-white/30"
          placeholder="No overview available"
          multiline
        />
      </Card>

      {/* Key Metrics Grid */}
      {data.metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6 text-center border-2 border-blue-200 bg-blue-50">
            <Users className="h-8 w-8 mx-auto mb-2 text-blue-600" />
            <EditableText
              value={String(data.metrics.participantsEngaged || 0)}
              onChange={(v) => updateMetric('participantsEngaged', Number(v))}
              type="number"
              className="text-3xl font-bold text-blue-600 mb-1"
            />
            <div className="text-sm font-medium text-gray-700">Participants</div>
          </Card>
          <Card className="p-6 text-center border-2 border-purple-200 bg-purple-50">
            <Target className="h-8 w-8 mx-auto mb-2 text-purple-600" />
            <EditableText
              value={String(data.metrics.domainsExplored || 0)}
              onChange={(v) => updateMetric('domainsExplored', Number(v))}
              type="number"
              className="text-3xl font-bold text-purple-600 mb-1"
            />
            <div className="text-sm font-medium text-gray-700">Domains Explored</div>
          </Card>
          <Card className="p-6 text-center border-2 border-green-200 bg-green-50">
            <Lightbulb className="h-8 w-8 mx-auto mb-2 text-green-600" />
            <EditableText
              value={String(data.metrics.insightsGenerated || 0)}
              onChange={(v) => updateMetric('insightsGenerated', Number(v))}
              type="number"
              className="text-3xl font-bold text-green-600 mb-1"
            />
            <div className="text-sm font-medium text-gray-700">Insights Generated</div>
          </Card>
          <Card className="p-6 text-center border-2 border-orange-200 bg-orange-50">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 text-orange-600" />
            <EditableText
              value={String(data.metrics.transformationalIdeas || 0)}
              onChange={(v) => updateMetric('transformationalIdeas', Number(v))}
              type="number"
              className="text-3xl font-bold text-orange-600 mb-1"
            />
            <div className="text-sm font-medium text-gray-700">Transformational Ideas</div>
          </Card>
        </div>
      )}

      {/* Key Findings Accordion */}
      {data.keyFindings && data.keyFindings.length > 0 && (
        <div>
          <h3 className="text-xl font-bold mb-4">Key Findings</h3>
          <Accordion type="multiple" className="w-full space-y-3">
            {data.keyFindings.map((finding: any, idx: number) => {
              const impactColors = {
                'Critical': { border: 'border-red-300', bg: 'bg-red-50', badge: 'bg-red-500' },
                'High': { border: 'border-orange-300', bg: 'bg-orange-50', badge: 'bg-orange-500' },
                'Transformational': { border: 'border-green-300', bg: 'bg-green-50', badge: 'bg-green-500' }
              };
              const colors = impactColors[finding.impact as keyof typeof impactColors] || impactColors.High;

              return (
                <AccordionItem
                  key={idx}
                  value={`finding-${idx}`}
                  className={`border-2 ${colors.border} ${colors.bg} rounded-lg px-6`}
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-4 text-left w-full">
                      <div className="flex-1">
                        <EditableText
                          value={finding.title}
                          onChange={(v) => updateFinding(idx, 'title', v)}
                          className="font-bold text-lg mb-1"
                        />
                        <div className="flex items-center gap-2">
                          <EditableText
                            value={finding.impact}
                            onChange={(v) => updateFinding(idx, 'impact', v)}
                            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold text-white ${colors.badge}`}
                          />
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pt-2">
                      <EditableText
                        value={finding.description}
                        onChange={(v) => updateFinding(idx, 'description', v)}
                        className="text-sm leading-relaxed text-gray-700"
                        multiline
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      )}
    </div>
  );
}

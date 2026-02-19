'use client';

import { Card } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Shield, Code, DollarSign, Users } from 'lucide-react';
import { EditableText } from './EditableText';
import { AiInsightCard } from './AiInsightCard';

interface ConstraintsTabProps {
  data: any;
  onChange?: (data: any) => void;
}

const impactColors: Record<string, string> = {
  Critical: 'bg-red-100 text-red-800 border-red-300',
  High: 'bg-orange-100 text-orange-800 border-orange-300',
  Medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  Low: 'bg-green-100 text-green-800 border-green-300',
};

// Pre-defined Tailwind class maps — avoids dynamic class construction that Tailwind can't detect
const colorStyles: Record<string, { border200: string; bg50: string; text600: string; border100: string }> = {
  blue:   { border200: 'border-blue-200',   bg50: 'bg-blue-50',   text600: 'text-blue-600',   border100: 'border-blue-100' },
  purple: { border200: 'border-purple-200', bg50: 'bg-purple-50', text600: 'text-purple-600', border100: 'border-purple-100' },
  green:  { border200: 'border-green-200',  bg50: 'bg-green-50',  text600: 'text-green-600',  border100: 'border-green-100' },
  orange: { border200: 'border-orange-200', bg50: 'bg-orange-50', text600: 'text-orange-600', border100: 'border-orange-100' },
};

const mitigationStyles: Record<string, { bg50: string; border400: string; text900: string; text800: string }> = {
  green:  { bg50: 'bg-green-50',  border400: 'border-green-400',  text900: 'text-green-900',  text800: 'text-green-800' },
  purple: { bg50: 'bg-purple-50', border400: 'border-purple-400', text900: 'text-purple-900', text800: 'text-purple-800' },
  orange: { bg50: 'bg-orange-50', border400: 'border-orange-400', text900: 'text-orange-900', text800: 'text-orange-800' },
};

const CATEGORIES = [
  { key: 'regulatory', label: 'Regulatory Constraints', sublabel: 'compliance requirements', Icon: Shield, color: 'blue', mitigationColor: 'green' },
  { key: 'technical', label: 'Technical Constraints', sublabel: 'technical blockers', Icon: Code, color: 'purple', mitigationColor: 'purple' },
  { key: 'commercial', label: 'Commercial Constraints', sublabel: 'commercial barriers', Icon: DollarSign, color: 'green', mitigationColor: 'green' },
  { key: 'organizational', label: 'Organizational Constraints', sublabel: 'people & culture barriers', Icon: Users, color: 'orange', mitigationColor: 'orange' },
] as const;

export function ConstraintsTab({ data, onChange }: ConstraintsTabProps) {
  if (!data || typeof data !== 'object') {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No constraints data yet. Click &quot;🎯 Load Complete Demo&quot; to populate this tab.
        </p>
      </Card>
    );
  }

  const updateItem = (category: string, idx: number, field: string, value: string) => {
    if (!onChange) return;
    const updated = {
      ...data,
      [category]: data[category].map((item: any, i: number) =>
        i === idx ? { ...item, [field]: value } : item
      ),
    };
    onChange(updated);
  };

  return (
    <div className="space-y-6">
      {/* AI Executive Insight */}
      {data._aiSummary && <AiInsightCard summary={data._aiSummary} />}

      <div>
        <h2 className="text-2xl font-bold mb-2">Constraints &amp; Blockers</h2>
        <p className="text-muted-foreground">
          Known constraints organized by category. Each includes impact assessment and mitigation strategy.
        </p>
      </div>

      <Accordion type="multiple" className="w-full space-y-4">
        {CATEGORIES.map(({ key, label, sublabel, Icon, color, mitigationColor }) => {
          const items = data[key];
          if (!items) return null;
          const cs = colorStyles[color];
          const ms = mitigationStyles[mitigationColor];

          return (
            <AccordionItem
              key={key}
              value={key}
              className={`border-2 ${cs.border200} ${cs.bg50} rounded-lg px-6`}
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-4">
                  <Icon className={`h-8 w-8 ${cs.text600}`} />
                  <div className="text-left">
                    <div className="font-bold text-lg">{label}</div>
                    <div className="text-sm opacity-70">{items.length} {sublabel}</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-4">
                  {items.map((item: any, idx: number) => (
                    <Card key={idx} className={`p-4 border-2 ${cs.border100}`}>
                      <div className="flex items-start justify-between mb-3">
                        <EditableText
                          value={item.title}
                          onChange={(v) => updateItem(key, idx, 'title', v)}
                          className="font-semibold"
                        />
                        <EditableText
                          value={item.impact}
                          onChange={(v) => updateItem(key, idx, 'impact', v)}
                          className={`text-xs px-2 py-1 rounded border ${impactColors[item.impact] || ''}`}
                        />
                      </div>
                      <EditableText
                        value={item.description}
                        onChange={(v) => updateItem(key, idx, 'description', v)}
                        className="text-sm text-muted-foreground mb-3"
                        multiline
                      />
                      <div className={`${ms.bg50} border-l-4 ${ms.border400} p-3`}>
                        <p className={`text-sm font-medium ${ms.text900}`}>Mitigation:</p>
                        <EditableText
                          value={item.mitigation}
                          onChange={(v) => updateItem(key, idx, 'mitigation', v)}
                          className={`text-sm ${ms.text800}`}
                          multiline
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

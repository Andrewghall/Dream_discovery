import { Card } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Lightbulb, CheckCircle2, Target, Calendar } from 'lucide-react';

interface SummaryTabProps {
  data: any;
}

export function SummaryTab({ data }: SummaryTabProps) {
  if (!data || typeof data !== 'object') {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No summary data yet. Click "🎯 Load Complete Demo" to populate this tab.
        </p>
      </Card>
    );
  }

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
                    <div className="font-bold text-lg">{category.category}</div>
                    <div className="text-sm opacity-70">{category.findings.length} key insights</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-3 pt-4">
                  {category.findings.map((finding: string, i: number) => (
                    <li key={i} className="flex gap-3 p-3 bg-white rounded-lg border">
                      <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm leading-relaxed">{finding}</span>
                    </li>
                  ))}
                </ul>
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
                          <h4 className="font-semibold text-lg">{step.step}</h4>
                          <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800 border border-green-300">
                            {step.timeframe}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">Owner: {step.owner}</p>
                        <ul className="space-y-2">
                          {step.actions.map((action: string, i: number) => (
                            <li key={i} className="flex gap-2 text-sm">
                              <span className="text-green-600">▸</span>
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
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
                    <h4 className="font-semibold text-indigo-900 mb-2">{metric.metric}</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Baseline:</span>
                        <span className="font-medium">{metric.baseline}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Target:</span>
                        <span className="font-medium text-green-700">{metric.target}</span>
                      </div>
                      <div className="text-xs text-muted-foreground pt-1 border-t">
                        {metric.measurement}
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

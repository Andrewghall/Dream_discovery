import { Card } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { DollarSign, TrendingUp, Calendar, AlertTriangle } from 'lucide-react';

interface CommercialTabProps {
  data: any;
}

export function CommercialTab({ data }: CommercialTabProps) {
  if (!data || typeof data !== 'object') {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No commercial data yet. Click "🎯 Load Complete Demo" to populate this tab.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
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
            <DollarSign className="h-8 w-8 mx-auto mb-2 text-blue-600" />
            <div className="text-3xl font-bold text-blue-600">{data.investmentSummary.totalInvestment}</div>
            <div className="text-sm text-muted-foreground">Total Investment</div>
          </Card>
          <Card className="p-6 text-center border-2 border-green-100 bg-green-50">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-600" />
            <div className="text-3xl font-bold text-green-600">{data.investmentSummary.fiveYearROI}</div>
            <div className="text-sm text-muted-foreground">5-Year ROI</div>
          </Card>
          <Card className="p-6 text-center border-2 border-orange-100 bg-orange-50">
            <Calendar className="h-8 w-8 mx-auto mb-2 text-orange-600" />
            <div className="text-3xl font-bold text-orange-600">{data.investmentSummary.paybackPeriod}</div>
            <div className="text-sm text-muted-foreground">Payback Period</div>
          </Card>
          <Card className="p-6 text-center border-2 border-purple-100 bg-purple-50">
            <DollarSign className="h-8 w-8 mx-auto mb-2 text-purple-600" />
            <div className="text-3xl font-bold text-purple-600">{data.investmentSummary.annualSavings}</div>
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
                    <div className="font-bold">{phase.phase}</div>
                    <div className="text-sm opacity-70 flex gap-3">
                      <span>{phase.duration}</span>
                      <span>•</span>
                      <span className="font-semibold text-indigo-900">{phase.investment}</span>
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-4">
                  {/* Scope */}
                  <div>
                    <h4 className="font-semibold mb-2">Scope</h4>
                    <ul className="space-y-2">
                      {phase.scope.map((item: string, i: number) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <span className="text-indigo-600">▸</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Outcomes */}
                  <div className="bg-green-50 border-l-4 border-green-400 p-4">
                    <h4 className="font-semibold text-green-900 mb-2">Expected Outcomes</h4>
                    <ul className="space-y-2">
                      {phase.outcomes.map((item: string, i: number) => (
                        <li key={i} className="flex gap-2 text-sm text-green-800">
                          <span className="text-green-600">✓</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
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
                      <h4 className="font-semibold flex-1">{risk.risk}</h4>
                      <div className="flex gap-2">
                        <span className="text-xs px-2 py-1 rounded border bg-orange-100 text-orange-800 border-orange-300">
                          {risk.probability}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded border ${
                          risk.impact === 'Critical'
                            ? 'bg-red-100 text-red-800 border-red-300'
                            : 'bg-orange-100 text-orange-800 border-orange-300'
                        }`}>
                          {risk.impact}
                        </span>
                      </div>
                    </div>
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-3">
                      <p className="text-sm font-medium text-blue-900">Mitigation:</p>
                      <p className="text-sm text-blue-800">{risk.mitigation}</p>
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

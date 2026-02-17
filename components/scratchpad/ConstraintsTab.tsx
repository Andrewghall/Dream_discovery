import { Card } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Shield, Code, DollarSign, Users } from 'lucide-react';

interface ConstraintsTabProps {
  data: any;
}

const impactColors: Record<string, string> = {
  Critical: 'bg-red-100 text-red-800 border-red-300',
  High: 'bg-orange-100 text-orange-800 border-orange-300',
  Medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  Low: 'bg-green-100 text-green-800 border-green-300',
};

export function ConstraintsTab({ data }: ConstraintsTabProps) {
  if (!data || typeof data !== 'object') {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No constraints data yet. Click "🎯 Load Complete Demo" to populate this tab.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Constraints & Blockers</h2>
        <p className="text-muted-foreground">
          Known constraints organized by category. Each includes impact assessment and mitigation strategy.
        </p>
      </div>

      <Accordion type="multiple" className="w-full space-y-4">
        {/* Regulatory Constraints */}
        {data.regulatory && (
          <AccordionItem value="regulatory" className="border-2 border-blue-200 bg-blue-50 rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-4">
                <Shield className="h-8 w-8 text-blue-600" />
                <div className="text-left">
                  <div className="font-bold text-lg">Regulatory Constraints</div>
                  <div className="text-sm opacity-70">{data.regulatory.length} compliance requirements</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-4">
                {data.regulatory.map((item: any, idx: number) => (
                  <Card key={idx} className="p-4 border-2 border-blue-100">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-semibold">{item.title}</h4>
                      <span className={`text-xs px-2 py-1 rounded border ${impactColors[item.impact]}`}>
                        {item.impact}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{item.description}</p>
                    <div className="bg-green-50 border-l-4 border-green-400 p-3">
                      <p className="text-sm font-medium text-green-900">Mitigation:</p>
                      <p className="text-sm text-green-800">{item.mitigation}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Technical Constraints */}
        {data.technical && (
          <AccordionItem value="technical" className="border-2 border-purple-200 bg-purple-50 rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-4">
                <Code className="h-8 w-8 text-purple-600" />
                <div className="text-left">
                  <div className="font-bold text-lg">Technical Constraints</div>
                  <div className="text-sm opacity-70">{data.technical.length} technical blockers</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-4">
                {data.technical.map((item: any, idx: number) => (
                  <Card key={idx} className="p-4 border-2 border-purple-100">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-semibold">{item.title}</h4>
                      <span className={`text-xs px-2 py-1 rounded border ${impactColors[item.impact]}`}>
                        {item.impact}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{item.description}</p>
                    <div className="bg-purple-50 border-l-4 border-purple-400 p-3">
                      <p className="text-sm font-medium text-purple-900">Mitigation:</p>
                      <p className="text-sm text-purple-800">{item.mitigation}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Commercial Constraints */}
        {data.commercial && (
          <AccordionItem value="commercial" className="border-2 border-green-200 bg-green-50 rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-4">
                <DollarSign className="h-8 w-8 text-green-600" />
                <div className="text-left">
                  <div className="font-bold text-lg">Commercial Constraints</div>
                  <div className="text-sm opacity-70">{data.commercial.length} commercial barriers</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-4">
                {data.commercial.map((item: any, idx: number) => (
                  <Card key={idx} className="p-4 border-2 border-green-100">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-semibold">{item.title}</h4>
                      <span className={`text-xs px-2 py-1 rounded border ${impactColors[item.impact]}`}>
                        {item.impact}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{item.description}</p>
                    <div className="bg-green-50 border-l-4 border-green-400 p-3">
                      <p className="text-sm font-medium text-green-900">Mitigation:</p>
                      <p className="text-sm text-green-800">{item.mitigation}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Organizational Constraints */}
        {data.organizational && (
          <AccordionItem value="organizational" className="border-2 border-orange-200 bg-orange-50 rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-4">
                <Users className="h-8 w-8 text-orange-600" />
                <div className="text-left">
                  <div className="font-bold text-lg">Organizational Constraints</div>
                  <div className="text-sm opacity-70">{data.organizational.length} people & culture barriers</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-4">
                {data.organizational.map((item: any, idx: number) => (
                  <Card key={idx} className="p-4 border-2 border-orange-100">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-semibold">{item.title}</h4>
                      <span className={`text-xs px-2 py-1 rounded border ${impactColors[item.impact]}`}>
                        {item.impact}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{item.description}</p>
                    <div className="bg-orange-50 border-l-4 border-orange-400 p-3">
                      <p className="text-sm font-medium text-orange-900">Mitigation:</p>
                      <p className="text-sm text-orange-800">{item.mitigation}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}

import { Card } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Users, TrendingUp, Brain } from 'lucide-react';

interface DiscoveryOutputTabProps {
  data: any;
}

const colorMap: Record<string, { border: string; bg: string; text: string }> = {
  blue: { border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-600' },
  purple: { border: 'border-purple-200', bg: 'bg-purple-50', text: 'text-purple-600' },
  green: { border: 'border-green-200', bg: 'bg-green-50', text: 'text-green-600' },
  orange: { border: 'border-orange-200', bg: 'bg-orange-50', text: 'text-orange-600' },
  indigo: { border: 'border-indigo-200', bg: 'bg-indigo-50', text: 'text-indigo-600' },
  pink: { border: 'border-pink-200', bg: 'bg-pink-50', text: 'text-pink-600' },
};

const sizeClasses = [
  'text-xl text-opacity-70',
  'text-2xl',
  'text-3xl font-semibold',
  'text-4xl font-bold',
];

export function DiscoveryOutputTab({ data }: DiscoveryOutputTabProps) {
  if (!data || !data.sections) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No discovery interview data yet. Click "🎯 Load Complete Demo" to populate this tab.
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
                    <div className="font-bold text-lg">{section.domain}</div>
                    <div className="text-sm opacity-70">
                      {section.utteranceCount} insights • Top themes: {section.topThemes?.join(', ')}
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-4">
                  {/* Word Cloud Representation */}
                  {section.wordCloud && (
                    <div className="bg-white p-6 rounded-lg border">
                      <h4 className="font-semibold mb-4">Key Themes (Word Cloud)</h4>
                      <div className="flex flex-wrap gap-3 items-center justify-center">
                        {section.wordCloud.map((item: any, i: number) => {
                          const sizeClass = sizeClasses[Math.min(item.size - 1, 3)] || sizeClasses[0];
                          return (
                            <span
                              key={i}
                              className={`${sizeClass} ${colors.text}`}
                              style={{ opacity: 0.5 + (item.size * 0.125) }}
                            >
                              {item.word}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Key Quotes */}
                  {section.quotes && (
                    <div>
                      <h4 className="font-semibold mb-3">Representative Quotes</h4>
                      <div className="space-y-3">
                        {section.quotes.map((quote: any, i: number) => (
                          <Card key={i} className={`p-4 border-l-4 ${colors.border.replace('border-', 'border-l-')} bg-white`}>
                            <p className="text-sm italic mb-2">&ldquo;{quote.text}&rdquo;</p>
                            <p className="text-xs text-muted-foreground">— {quote.author}</p>
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
                        <span>Concerned ({section.sentiment.concerned}%)</span>
                        <span>Neutral ({section.sentiment.neutral}%)</span>
                        <span>Optimistic ({section.sentiment.optimistic}%)</span>
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Spider Diagram - Consensus by Domain */}
      <Card className="p-6 border-2 border-indigo-100">
        <h3 className="font-bold text-lg mb-4">Domain Coverage & Consensus</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Spider diagram showing participant engagement and consensus levels across domains
        </p>
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-8 rounded-lg">
          <div className="text-center text-muted-foreground">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-sm">
              Interactive spider diagram would be rendered here showing:
              <br />
              {data.sections?.map((s: any, i: number) => (
                <span key={i}>
                  {s.domain} ({s.consensusLevel}% consensus)
                  {i < data.sections.length - 1 ? ' • ' : ''}
                </span>
              ))}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

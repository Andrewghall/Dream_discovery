import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, TrendingUp, DollarSign } from 'lucide-react';

interface IntelligenceItem {
  title: string;
  insight: string;
}

interface LinkedIntelligenceProps {
  clinical?: IntelligenceItem[];
  strategic?: IntelligenceItem[];
  commercial?: IntelligenceItem[];
}

export function LinkedIntelligence({ clinical, strategic, commercial }: LinkedIntelligenceProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
        Linked Intelligence
      </h3>

      {clinical && clinical.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-blue-900 flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Clinical
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {clinical.map((item, index) => (
              <div key={index} className="text-sm">
                <p className="font-medium text-blue-900 mb-1">{item.title}</p>
                <p className="text-blue-700 text-xs leading-relaxed">{item.insight}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {strategic && strategic.length > 0 && (
        <Card className="bg-purple-50 border-purple-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-purple-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Strategic
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {strategic.map((item, index) => (
              <div key={index} className="text-sm">
                <p className="font-medium text-purple-900 mb-1">{item.title}</p>
                <p className="text-purple-700 text-xs leading-relaxed">{item.insight}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {commercial && commercial.length > 0 && (
        <Card className="bg-green-50 border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-green-900 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Commercial
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {commercial.map((item, index) => (
              <div key={index} className="text-sm">
                <p className="font-medium text-green-900 mb-1">{item.title}</p>
                <p className="text-green-700 text-xs leading-relaxed">{item.insight}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

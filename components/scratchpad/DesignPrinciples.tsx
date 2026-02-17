import { Badge } from '@/components/ui/badge';

interface DesignPrinciple {
  label: string;
  category: 'core' | 'approach' | 'technical' | 'strategic' | 'governance';
}

interface DesignPrinciplesProps {
  principles: DesignPrinciple[];
}

const categoryColors = {
  core: 'bg-blue-100 text-blue-900 border-blue-300',
  approach: 'bg-purple-100 text-purple-900 border-purple-300',
  technical: 'bg-green-100 text-green-900 border-green-300',
  strategic: 'bg-orange-100 text-orange-900 border-orange-300',
  governance: 'bg-pink-100 text-pink-900 border-pink-300',
};

export function DesignPrinciples({ principles }: DesignPrinciplesProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-900">Design Principles</h3>
      <p className="text-sm text-gray-600">
        Core principles guiding all technical decisions
      </p>

      <div className="flex flex-wrap gap-2">
        {principles.map((principle, index) => (
          <Badge
            key={index}
            variant="outline"
            className={`px-3 py-1.5 text-sm font-medium ${categoryColors[principle.category]}`}
          >
            {principle.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

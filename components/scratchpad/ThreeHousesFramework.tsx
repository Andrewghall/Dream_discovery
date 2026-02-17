import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';

export function ThreeHousesFramework() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">The Three Houses Framework</h2>
        <p className="text-muted-foreground">
          Moving from today's constrained reality, past incremental changes, to true transformational reimagination.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* House 1: The Old House - Today's Constrained Reality */}
        <Card className="border-2 border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-lg text-red-900">
              The Old House
            </CardTitle>
            <p className="text-sm text-red-700">Today's Constrained Way</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative w-full h-48 mb-4">
              <Image
                src="/PAMWellness/house-old.png"
                alt="The Old House - Today's Constrained Reality"
                fill
                className="object-contain"
              />
            </div>
            <p className="text-sm font-medium text-red-900">The Noisy, Cluttered Present</p>
            <ul className="text-sm text-red-800 space-y-2">
              <li>• Full of internal noise and politics</li>
              <li>• Constrained by legacy systems</li>
              <li>• Limited by "how we've always done it"</li>
              <li>• Weighed down by accumulated baggage</li>
            </ul>
            <p className="text-xs italic text-red-700 mt-3">
              This is where we are stuck today.
            </p>
          </CardContent>
        </Card>

        {/* House 2: The Refreshed House - Small Incremental Steps */}
        <Card className="border-2 border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-lg text-orange-900">
              The Refreshed House
            </CardTitle>
            <p className="text-sm text-orange-700">Small Incremental Steps</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative w-full h-48 mb-4">
              <Image
                src="/PAMWellness/house-refreshed.png"
                alt="The Refreshed House - Incremental Changes"
                fill
                className="object-contain"
              />
            </div>
            <p className="text-sm font-medium text-orange-900">The Trap of Small Fixes</p>
            <ul className="text-sm text-orange-800 space-y-2">
              <li>• Polish the existing approach</li>
              <li>• Make incremental improvements</li>
              <li>• Optimize what already exists</li>
              <li>• Same house, slightly better paint</li>
            </ul>
            <p className="text-xs italic text-orange-700 mt-3">
              This makes little material difference - still constrained.
            </p>
          </CardContent>
        </Card>

        {/* House 3: The Ideal House - True Reimagination */}
        <Card className="border-2 border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-lg text-green-900">
              The Ideal House
            </CardTitle>
            <p className="text-sm text-green-700">Transformational Reimagination</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative w-full h-48 mb-4">
              <Image
                src="/PAMWellness/house-ideal.png"
                alt="The Ideal House - True Reimagination"
                fill
                className="object-contain"
              />
            </div>
            <p className="text-sm font-medium text-green-900">The Next Level</p>
            <ul className="text-sm text-green-800 space-y-2">
              <li>• If we could start from scratch today...</li>
              <li>• With no legacy constraints...</li>
              <li>• Ignoring "how it's always been done"...</li>
              <li>• What would we actually build?</li>
            </ul>
            <p className="text-xs italic text-green-700 mt-3">
              This is transformational change - material difference.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Guide */}
      <Card className="mt-6 border-2 border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="text-base">The Strategic Choice</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <p className="font-medium text-foreground">
            Most organizations get stuck in the middle house - making small improvements that feel productive but don't create material change.
          </p>

          <div className="space-y-2 text-muted-foreground">
            <p>
              <strong className="text-red-900">The Old House (Left):</strong> Today's reality is noisy and constrained. Full of internal politics, external pressures, legacy systems, and "how we've always done it."
            </p>
            <p>
              <strong className="text-orange-900">The Refreshed House (Middle) - THE TRAP:</strong> Small incremental steps that polish the existing approach. You're still in the same constrained house, just with slightly better paint. This makes little material difference.
            </p>
            <p>
              <strong className="text-green-900">The Ideal House (Right) - THE GOAL:</strong> True reimagination. Remove all the noise - internal and external. Ask: "If we could start from scratch today, with no constraints, what would we build?" This is transformational change - the next level.
            </p>
          </div>

          <p className="pt-3 italic border-t border-yellow-300 text-foreground">
            <strong>The point of DREAM workshops:</strong> Force teams to skip the middle house and reimagine without constraints. The agentic AI helps identify which insights are transformational (Ideal House) vs incremental (Refreshed House).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

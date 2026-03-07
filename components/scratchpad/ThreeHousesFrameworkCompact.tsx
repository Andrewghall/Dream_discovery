import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Image from 'next/image';

export function ThreeHousesFrameworkCompact() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">The Three Houses Framework</h2>
        <p className="text-muted-foreground">
          Moving from today's constrained reality, past incremental changes, to true transformational reimagination.
        </p>
      </div>

      {/* Compact Cards with Accordion */}
      <Accordion type="single" collapsible className="w-full space-y-4">
        {/* House 1: The Old House */}
        <AccordionItem value="old-house" className="border-2 border-red-200 bg-red-50 rounded-lg px-6">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-4">
              <div className="text-4xl">🏚️</div>
              <div className="text-left">
                <div className="font-bold text-red-900">The Old House</div>
                <div className="text-sm text-red-700">Today's Constrained Way</div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex gap-6">
              <div className="relative w-48 h-48 flex-shrink-0">
                <Image
                  src="/framework/house-old.png"
                  alt="The Old House"
                  fill
                  className="object-contain"
                />
              </div>
              <div className="flex-1 space-y-3">
                <p className="text-sm font-medium text-red-900">The Noisy, Cluttered Present</p>
                <ul className="text-sm text-red-800 space-y-2">
                  <li>• Full of internal noise and politics</li>
                  <li>• Constrained by legacy systems</li>
                  <li>• Limited by "how we've always done it"</li>
                  <li>• Weighed down by accumulated baggage</li>
                </ul>
                <p className="text-xs italic text-red-700 pt-2 border-t border-red-200">
                  This is where we are stuck today.
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* House 2: The Refreshed House */}
        <AccordionItem value="refreshed-house" className="border-2 border-orange-200 bg-orange-50 rounded-lg px-6">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-4">
              <div className="text-4xl">🏠</div>
              <div className="text-left">
                <div className="font-bold text-orange-900">The Refreshed House</div>
                <div className="text-sm text-orange-700">Small Incremental Steps</div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex gap-6">
              <div className="relative w-48 h-48 flex-shrink-0">
                <Image
                  src="/framework/house-refreshed.png"
                  alt="The Refreshed House"
                  fill
                  className="object-contain"
                />
              </div>
              <div className="flex-1 space-y-3">
                <p className="text-sm font-medium text-orange-900">The Trap of Small Fixes</p>
                <ul className="text-sm text-orange-800 space-y-2">
                  <li>• Polish the existing approach</li>
                  <li>• Make incremental improvements</li>
                  <li>• Optimize what already exists</li>
                  <li>• Same house, slightly better paint</li>
                </ul>
                <p className="text-xs italic text-orange-700 pt-2 border-t border-orange-200">
                  This makes little material difference - still constrained.
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* House 3: The Ideal House */}
        <AccordionItem value="ideal-house" className="border-2 border-green-200 bg-green-50 rounded-lg px-6">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-4">
              <div className="text-4xl">🏡</div>
              <div className="text-left">
                <div className="font-bold text-green-900">The Ideal House</div>
                <div className="text-sm text-green-700">Transformational Reimagination</div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex gap-6">
              <div className="relative w-48 h-48 flex-shrink-0">
                <Image
                  src="/framework/house-ideal.png"
                  alt="The Ideal House"
                  fill
                  className="object-contain"
                />
              </div>
              <div className="flex-1 space-y-3">
                <p className="text-sm font-medium text-green-900">The Next Level</p>
                <ul className="text-sm text-green-800 space-y-2">
                  <li>• If we could start from scratch today...</li>
                  <li>• With no legacy constraints...</li>
                  <li>• Ignoring "how it's always been done"...</li>
                  <li>• What would we actually build?</li>
                </ul>
                <p className="text-xs italic text-green-700 pt-2 border-t border-green-200">
                  This is transformational change - material difference.
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Compact Usage Guide */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="guide" className="border-2 border-yellow-200 bg-yellow-50 rounded-lg px-6">
          <AccordionTrigger className="hover:no-underline">
            <div className="font-semibold">The Strategic Choice → Click to expand</div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 text-sm">
            <p className="font-medium text-foreground">
              Most organizations get stuck in the middle house - making small improvements that feel productive but don't create material change.
            </p>
            <div className="space-y-2 text-muted-foreground">
              <p>
                <strong className="text-red-900">The Old House:</strong> Today's reality is noisy and constrained.
              </p>
              <p>
                <strong className="text-orange-900">The Refreshed House - THE TRAP:</strong> Small incremental steps that polish the existing approach.
              </p>
              <p>
                <strong className="text-green-900">The Ideal House - THE GOAL:</strong> True reimagination. Remove all the noise and ask: "If we could start from scratch today, what would we build?"
              </p>
            </div>
            <p className="pt-3 italic border-t border-yellow-300 text-foreground">
              <strong>The point of DREAM workshops:</strong> Force teams to skip the middle house and reimagine without constraints.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

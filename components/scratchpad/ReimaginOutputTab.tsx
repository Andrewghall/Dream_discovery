import { Card } from '@/components/ui/card';
import Image from 'next/image';

interface ReimaginOutputTabProps {
  data: any;
}

export function ReimaginOutputTab({ data }: ReimaginOutputTabProps) {
  if (!data || typeof data !== 'object') {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No reimagine data yet. Click "🎯 Load Complete Demo" to populate this tab.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-12 bg-[#f8f4ec] -mx-8 -my-8 px-8 py-12 min-h-screen">
      {/* Title Section - EXACT PAM WELLNESS STYLE */}
      <div className="bg-white rounded-3xl p-16 border-0 shadow-sm">
        <div className="inline-block px-4 py-1.5 rounded-full border border-black/10 text-[10px] uppercase tracking-[0.25em] text-black/40 mb-8 font-medium">
          REIMAGINE OUTPUT
        </div>
        <h1 className="text-7xl font-semibold mb-8 leading-[1.1] text-gray-900" style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}>
          {data?.reimagineContent?.title || 'Reimagine Output'}
        </h1>
        <div className="space-y-6 max-w-4xl">
          <p className="text-lg text-gray-700 leading-relaxed">
            {data?.reimagineContent?.description || 'The Reimagine session focused on defining the future direction of the business.'}
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            {data?.reimagineContent?.subtitle || 'The conversation explored what must change in the way the business operates and delivers value.'}
          </p>
          <p className="text-sm text-gray-500 leading-relaxed italic">
            The themes below are presented in order of importance and emphasis during the session.
          </p>
        </div>
      </div>

      {/* Three Houses */}
      <div>
        <div className="text-xs uppercase tracking-[0.15em] text-[#D4A89A] mb-8 font-medium">
          HOW WE APPROACHED THE REIMAGINE SESSION
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-red-50 rounded-xl overflow-hidden shadow-md border-2 border-red-100">
            <div className="relative w-full h-64 bg-gray-100">
              <Image src="/PAMWellness/house-old.png" alt="The Old House" fill className="object-cover" />
            </div>
            <div className="p-6 space-y-2">
              <h3 className="font-bold text-lg text-gray-900">The Old House</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                What do we see today? Where are things patched, fragile or overly complex?
              </p>
            </div>
          </div>
          <div className="bg-orange-50 rounded-xl overflow-hidden shadow-md border-2 border-orange-100">
            <div className="relative w-full h-64 bg-gray-100">
              <Image src="/PAMWellness/house-refreshed.png" alt="The Refreshed House" fill className="object-cover" />
            </div>
            <div className="p-6 space-y-2">
              <h3 className="font-bold text-lg text-gray-900">The Refreshed House</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                What improves but remains structurally the same?
              </p>
            </div>
          </div>
          <div className="bg-green-50 rounded-xl overflow-hidden shadow-md border-2 border-green-100">
            <div className="relative w-full h-64 bg-gray-100">
              <Image src="/PAMWellness/house-ideal.png" alt="The Ideal House" fill className="object-cover" />
            </div>
            <div className="p-6 space-y-2">
              <h3 className="font-bold text-lg text-gray-900">The Ideal House</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Ignoring walls and constraints. What would we design from the ground up? What would feel effortless?
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Green Boxes in horizontal row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* First Green Box from supportingSection */}
        {data?.reimagineContent?.supportingSection && (
          <div className="bg-gradient-to-br from-teal-100 to-emerald-100 rounded-2xl p-10 border-2 border-teal-200">
            <h3 className="font-bold text-3xl mb-4 text-gray-900">{data.reimagineContent.supportingSection.title}</h3>
            <p className="text-sm text-gray-800 mb-7 leading-relaxed font-medium">
              {data.reimagineContent.supportingSection.description}
            </p>
            <ul className="space-y-4">
              {data.reimagineContent.supportingSection.points?.map((point: string, index: number) => (
                <li key={index} className="flex items-start gap-4">
                  <span className="text-teal-700 font-bold text-xl mt-0.5">•</span>
                  <span className="text-sm text-gray-900 leading-relaxed font-medium">
                    {point}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Accordion sections as green boxes */}
        {data?.reimagineContent?.accordionSections?.map((section: any, index: number) => (
          <div key={index} className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-2xl p-10 border-2 border-teal-200">
            <h3 className="font-bold text-2xl mb-4 text-gray-900">{section.title}</h3>
            <p className="text-sm text-gray-800 mb-6 leading-relaxed font-medium">
              {section.description}
            </p>
            <ul className="space-y-4">
              {section.points?.map((point: string, pointIndex: number) => (
                <li key={pointIndex} className="flex items-start gap-4">
                  <span className="text-teal-700 font-bold text-xl mt-0.5">•</span>
                  <span className="text-sm text-gray-900 leading-relaxed font-medium">
                    {point}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Journey Mapping */}
      {data?.reimagineContent?.journeyMapping && (
        <div>
          <h3 className="font-bold text-3xl mb-8 text-gray-900">{data.reimagineContent.journeyMapping.title}</h3>
          <div className="p-20 bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl border-2 border-amber-200 text-center">
            <div className="text-8xl mb-6 opacity-30">🗺️</div>
            <h4 className="font-bold text-2xl mb-4 text-gray-900">Journey Mapping</h4>
            <p className="text-base text-gray-700 max-w-2xl mx-auto leading-relaxed">
              Once Journey Mapping is completed, the visual journey timeline will be uploaded here.
              This will show the step-by-step transformation journey with key touchpoints and stages.
            </p>
          </div>
        </div>
      )}

      {/* Primary Themes + SHIFT ONE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl p-10 shadow-sm">
            <h3 className="font-bold text-3xl mb-8 text-gray-900">Primary themes</h3>
            <div className="space-y-5">
            {data?.reimagineContent?.primaryThemes?.map((theme: any, index: number) => (
              <div key={index} className="p-6 border-l-[6px] border-orange-700 bg-gray-50 rounded-lg">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-10 h-10 rounded-full bg-orange-700 text-white flex items-center justify-center font-bold text-base flex-shrink-0">{index + 1}</div>
                    <div className="flex-1">
                      <span className="font-semibold text-gray-900 text-lg block mb-2">{theme.title}</span>
                      {theme.weighting && (
                        <span className="text-xs text-gray-500 italic">{theme.weighting}</span>
                      )}
                    </div>
                  </div>
                  <span className="px-4 py-2 rounded-full text-xs font-bold bg-orange-700 text-white uppercase tracking-wider flex-shrink-0">{theme.badge}</span>
                </div>
              </div>
            )) || (
              <div className="text-gray-500 italic">No primary themes defined yet</div>
            )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border-2 border-amber-300 shadow-md overflow-hidden h-full flex flex-col">
              <div className="p-8 bg-gradient-to-br from-amber-100 via-orange-100 to-amber-200">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-full bg-amber-700 text-white flex items-center justify-center font-bold">1</div>
                  <div className="text-xs uppercase tracking-[0.15em] text-amber-900 font-bold">SHIFT ONE</div>
                </div>
                <h4 className="font-bold text-2xl text-gray-900 leading-tight">
                  {data?.reimagineContent?.shiftOne?.title || 'First Key Shift'}
                </h4>
              </div>
              <div className="p-8 flex-1">
                <p className="text-sm text-gray-800 mb-5 leading-relaxed font-medium">
                  {data?.reimagineContent?.shiftOne?.description || 'Description of the first major shift or transformation theme from the reimagine session.'}
                </p>
                <div className="text-sm text-gray-700 space-y-3 leading-relaxed font-medium">
                  {data?.reimagineContent?.shiftOne?.details?.length > 0 ? (
                    data.reimagineContent.shiftOne.details.map((detail: string, index: number) => (
                      <p key={index}>• {detail}</p>
                    ))
                  ) : (
                    <>
                      <p>• Key detail point one</p>
                      <p>• Key detail point two</p>
                      <p>• Key detail point three</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
      </div>

      {/* Supporting Themes + SHIFT TWO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl p-10 shadow-sm">
            <h3 className="font-bold text-3xl mb-8 text-gray-900">Supporting themes</h3>
            <div className="space-y-5">
            {data?.reimagineContent?.supportingThemes?.map((theme: any, index: number) => (
              <div key={index} className="p-6 border-l-[6px] border-sky-500 bg-gray-50 rounded-lg">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-10 h-10 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold text-base flex-shrink-0">{index + 1}</div>
                    <div className="flex-1">
                      <span className="font-semibold text-gray-900 text-lg block mb-2">{theme.title}</span>
                      {theme.weighting && (
                        <span className="text-xs text-gray-500 italic">{theme.weighting}</span>
                      )}
                    </div>
                  </div>
                  <span className="px-4 py-2 rounded-full text-xs font-bold bg-sky-500 text-white uppercase tracking-wider flex-shrink-0">{theme.badge}</span>
                </div>
              </div>
            )) || (
              <div className="text-gray-500 italic">No supporting themes defined yet</div>
            )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border-2 border-sky-300 shadow-md overflow-hidden h-full flex flex-col">
              <div className="p-8 bg-gradient-to-br from-sky-100 via-blue-100 to-indigo-200">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-full bg-sky-700 text-white flex items-center justify-center font-bold">2</div>
                  <div className="text-xs uppercase tracking-[0.15em] text-sky-900 font-bold">SHIFT TWO</div>
                </div>
                <h4 className="font-bold text-2xl text-gray-900 leading-tight">
                  {data?.reimagineContent?.shiftTwo?.title || 'Second Key Shift'}
                </h4>
              </div>
              <div className="p-8 flex-1">
                <p className="text-sm text-gray-800 mb-5 leading-relaxed font-medium">
                  {data?.reimagineContent?.shiftTwo?.description || 'Description of the second major shift or transformation theme from the reimagine session.'}
                </p>
                <div className="text-sm text-gray-700 space-y-3 leading-relaxed font-medium">
                  {data?.reimagineContent?.shiftTwo?.details?.length > 0 ? (
                    data.reimagineContent.shiftTwo.details.map((detail: string, index: number) => (
                      <p key={index}>• {detail}</p>
                    ))
                  ) : (
                    <>
                      <p>• Key detail point one</p>
                      <p>• Key detail point two</p>
                      <p>• Key detail point three</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
      </div>

      {/* Horizon Vision Alignment */}
      <div>
        <h3 className="font-bold text-3xl mb-8 text-gray-900">
          {data?.reimagineContent?.horizonVision?.title || 'Horizon Vision Alignment'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {data?.reimagineContent?.horizonVision?.columns?.length > 0 ? (
            data.reimagineContent.horizonVision.columns.map((column: any, index: number) => (
              <div key={index} className="p-10 bg-white rounded-2xl shadow-md">
                <h4 className="font-bold text-xl mb-6 text-gray-900">{column.title}</h4>
                <ul className="space-y-4">
                  {column.points?.map((point: string, pointIndex: number) => (
                    <li key={pointIndex} className="flex items-start gap-4">
                      <span className="text-gray-400 font-bold text-xl mt-0.5">•</span>
                      <span className="text-sm text-gray-800 leading-relaxed font-medium">
                        {point}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <>
              <div className="p-10 bg-white rounded-2xl shadow-md">
                <h4 className="font-bold text-xl mb-6 text-gray-900">Horizon 1: Foundation (Months 1-6)</h4>
                <ul className="space-y-4">
                  <li className="flex items-start gap-4">
                    <span className="text-gray-400 font-bold text-xl mt-0.5">•</span>
                    <span className="text-sm text-gray-800 leading-relaxed font-medium">
                      First foundational initiative
                    </span>
                  </li>
                  <li className="flex items-start gap-4">
                    <span className="text-gray-400 font-bold text-xl mt-0.5">•</span>
                    <span className="text-sm text-gray-800 leading-relaxed font-medium">
                      Second foundational initiative
                    </span>
                  </li>
                </ul>
              </div>
              <div className="p-10 bg-white rounded-2xl shadow-md">
                <h4 className="font-bold text-xl mb-6 text-gray-900">Horizon 2: Transformation (Months 6-18)</h4>
                <ul className="space-y-4">
                  <li className="flex items-start gap-4">
                    <span className="text-gray-400 font-bold text-xl mt-0.5">•</span>
                    <span className="text-sm text-gray-800 leading-relaxed font-medium">
                      First transformation initiative
                    </span>
                  </li>
                  <li className="flex items-start gap-4">
                    <span className="text-gray-400 font-bold text-xl mt-0.5">•</span>
                    <span className="text-sm text-gray-800 leading-relaxed font-medium">
                      Second transformation initiative
                    </span>
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

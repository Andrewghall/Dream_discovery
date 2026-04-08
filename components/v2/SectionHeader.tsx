'use client';

interface SectionHeaderProps {
  section: string;
  purpose: string;
  domain?: string;
  lenses?: string[];
  interpretation: string;
}

export function SectionHeader({ section, purpose, domain, lenses, interpretation }: SectionHeaderProps) {
  return (
    <div className="mb-6 border-b border-slate-200 pb-5">
      <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
        SECTION
      </div>
      <h2 className="mb-2 text-2xl font-bold text-slate-900">{section}</h2>
      <p className="mb-3 text-sm text-slate-600 leading-relaxed">{purpose}</p>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {domain && (
          <span className="rounded bg-slate-100 px-2 py-1 font-medium">
            Domain: {domain}
          </span>
        )}
        {lenses && lenses.length > 0 && (
          <span className="rounded bg-slate-100 px-2 py-1 font-medium">
            Lenses: {lenses.join(' · ')}
          </span>
        )}
        <span className="text-slate-400 italic">{interpretation}</span>
      </div>
    </div>
  );
}

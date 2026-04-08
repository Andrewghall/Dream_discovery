import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page Not Found',
  robots: { index: false },
};

export default function DreamNotFound() {
  return (
    <section className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-black text-slate-200 mb-4">404</h1>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Page not found</h2>
        <p className="text-slate-500 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dream"
            className="px-6 py-3 text-sm font-semibold rounded-xl bg-[#5cf28e] text-[#0d0d0d] hover:bg-[#50c878] transition-all"
          >
            Back to DREAM
          </Link>
          <a
            href="mailto:Andrew.Hall@ethenta.com"
            className="px-6 py-3 text-sm font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all"
          >
            Contact Us
          </a>
        </div>
      </div>
    </section>
  );
}

import Image from 'next/image';
import Link from 'next/link';

export function DreamFooter() {
  return (
    <footer aria-label="Site footer" className="bg-slate-950 text-slate-400 py-16 px-6 pb-28">
      <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-12">
        {/* Brand */}
        <div>
          <Image
            src="/ethenta-logo.png"
            alt="Ethenta"
            width={120}
            height={35}
            className="brightness-0 invert mb-4"
          />
          <p className="text-sm leading-relaxed max-w-xs">
            Decision intelligence that transforms workshops into measurable organisational insight.
          </p>
        </div>

        {/* Quick links */}
        <div>
          <h4 className="text-white text-sm font-semibold mb-4">Quick Links</h4>
          <ul className="space-y-2">
            <li>
              <Link href="/dream/technology" className="text-sm hover:text-white transition-colors">
                EthentaFlow&trade;
              </Link>
            </li>
            <li>
              <Link href="/dream/methodology" className="text-sm hover:text-white transition-colors">
                Methodology
              </Link>
            </li>
            <li>
              <Link href="/dream/insights" className="text-sm hover:text-white transition-colors">
                Analytical Insights
              </Link>
            </li>
            <li>
              <Link href="/dream/how-it-works" className="text-sm hover:text-white transition-colors">
                How It Works
              </Link>
            </li>
            <li>
              <Link href="/dream/industries" className="text-sm hover:text-white transition-colors">
                Industries
              </Link>
            </li>
            <li>
              <Link href="/login" className="text-sm hover:text-white transition-colors">
                Sign In
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="text-sm hover:text-white transition-colors">
                Privacy Policy
              </Link>
            </li>
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="text-white text-sm font-semibold mb-4">Get in Touch</h4>
          <ul className="space-y-2">
            <li>
              <a
                href="mailto:hello@ethenta.com"
                className="text-sm hover:text-white transition-colors"
              >
                hello@ethenta.com
              </a>
            </li>
            <li>
              <a
                href="https://ethenta.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm hover:text-white transition-colors"
              >
                ethenta.com
              </a>
            </li>
          </ul>
          <div className="mt-6">
            <a
              href="mailto:hello@ethenta.com?subject=DREAM%20Demo%20Request"
              className="inline-block px-5 py-2.5 text-sm font-semibold rounded-lg bg-[#5cf28e] text-[#0d0d0d] hover:bg-[#50c878] transition-all shadow-sm"
            >
              Book a Demo
            </a>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-slate-800 text-sm text-center text-slate-500">
        &copy; {new Date().getFullYear()} Ethenta Ltd. All rights reserved. DREAM and EthentaFlow are trademarks of Ethenta Ltd.
      </div>
    </footer>
  );
}

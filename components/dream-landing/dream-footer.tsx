import Image from 'next/image';
import Link from 'next/link';
import { CalendlyButton } from './calendly-button';

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
            className="mb-4"
            style={{ mixBlendMode: 'screen' }}
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
                href="mailto:Andrew.Hall@ethenta.com"
                className="text-sm hover:text-white transition-colors"
              >
                Andrew.Hall@ethenta.com
              </a>
            </li>
            <li>
              <a
                href="https://wa.me/447471944765"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm hover:text-white transition-colors flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-[#25D366]">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
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
            <CalendlyButton
              className="inline-block px-5 py-2.5 text-sm font-semibold rounded-lg bg-[#5cf28e] text-[#0d0d0d] hover:bg-[#50c878] transition-all shadow-sm cursor-pointer"
            >
              Book a Demo
            </CalendlyButton>
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

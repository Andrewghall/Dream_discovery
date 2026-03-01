import type { Metadata } from 'next';
import { DreamNav } from '@/components/dream-landing/dream-nav';
import { DreamFooter } from '@/components/dream-landing/dream-footer';
import { DreamChatBar } from '@/components/dream-landing/dream-chat-bar';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://dream.ethenta.com';

export const metadata: Metadata = {
  title: {
    template: '%s | Ethenta DREAM',
    default: 'Ethenta DREAM  -  Workshop Intelligence Platform',
  },
  description:
    'AI-powered decision intelligence that transforms workshops into measurable organisational insight. Discover. Reimagine. Educate. Apply. Mobilise.',
  openGraph: {
    type: 'website',
    siteName: 'Ethenta DREAM',
    title: 'Ethenta DREAM  -  Workshop Intelligence Platform',
    description:
      'Turn every workshop into decision intelligence with EthentaFlow™  -  the AI engine that captures what people really think and reveals what organisations actually need.',
    images: [{ url: '/Dream.PNG', width: 1412, height: 510, alt: 'Ethenta DREAM  -  Workshop Intelligence Platform' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ethenta DREAM  -  Workshop Intelligence Platform',
    description:
      'Turn every workshop into decision intelligence with EthentaFlow™.',
    images: ['/Dream.PNG'],
  },
};

/* ── JSON-LD: SoftwareApplication + WebSite ────────────────── */
const softwareJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'DREAM',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'AI-powered workshop intelligence platform that captures what people really think, surfaces what organisations actually need, and transforms live workshops into measurable strategic insight.',
  url: `${SITE_URL}/dream`,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'GBP',
    description: 'Contact us for enterprise pricing',
  },
  creator: {
    '@type': 'Organization',
    name: 'Ethenta',
    url: SITE_URL,
  },
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Ethenta DREAM',
  url: `${SITE_URL}/dream`,
};

export default function DreamLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <DreamNav />
      <main className="pt-16">{children}</main>
      <DreamFooter />
      <DreamChatBar />
    </>
  );
}

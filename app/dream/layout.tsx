import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ethenta DREAM — Workshop Intelligence Platform',
  description:
    'AI-powered decision intelligence that transforms workshops into measurable organisational insight. Discover. Reimagine. Educate. Apply. Mobilise.',
  openGraph: {
    title: 'Ethenta DREAM — Workshop Intelligence Platform',
    description:
      'Turn every workshop into decision intelligence with EthentaFlow™ — the AI engine that captures what people really think and reveals what organisations actually need.',
    images: [{ url: '/Dream.PNG', width: 1412, height: 510, alt: 'Ethenta DREAM' }],
  },
};

export default function DreamLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

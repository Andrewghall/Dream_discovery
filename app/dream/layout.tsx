import type { Metadata } from 'next';
import { DreamNav } from '@/components/dream-landing/dream-nav';
import { DreamFooter } from '@/components/dream-landing/dream-footer';
import { DreamChatBar } from '@/components/dream-landing/dream-chat-bar';

export const metadata: Metadata = {
  title: {
    template: '%s | Ethenta DREAM',
    default: 'Ethenta DREAM — Workshop Intelligence Platform',
  },
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
  return (
    <>
      <DreamNav />
      <main className="pt-16">{children}</main>
      <DreamFooter />
      <DreamChatBar />
    </>
  );
}

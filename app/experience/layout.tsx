import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Experience DREAM — Ethenta',
  description: 'An interactive walkthrough of the DREAM methodology and EthentaFlow platform.',
};

// Full-screen experience — suppress the dream layout (nav + footer)
export default function ExperienceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

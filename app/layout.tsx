import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://dream.ethenta.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Ethenta — Enterprise Decision Intelligence',
    template: '%s | Ethenta',
  },
  description:
    'Ethenta builds enterprise decision intelligence tools that transform workshops into measurable organisational insight. Discover. Reimagine. Educate. Apply. Mobilise.',
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    siteName: 'Ethenta',
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
  },
};

/* ── Site-wide Organization JSON-LD ────────────────────────── */
const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Ethenta',
  url: SITE_URL,
  logo: `${SITE_URL}/ethenta-logo.png`,
  description:
    'Ethenta builds enterprise decision intelligence tools that transform workshops into measurable organisational insight.',
  email: 'Andrew.Hall@ethenta.com',
  sameAs: ['https://ethenta.com'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}

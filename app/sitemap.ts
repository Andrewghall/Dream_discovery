import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://dream.ethenta.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  /* ── Core marketing pages ─────────────────────────────────── */
  const corePages = [
    { path: '/dream', priority: 1.0, changeFrequency: 'weekly' as const },
    { path: '/dream/technology', priority: 0.9, changeFrequency: 'monthly' as const },
    { path: '/dream/methodology', priority: 0.9, changeFrequency: 'monthly' as const },
    { path: '/dream/insights', priority: 0.9, changeFrequency: 'monthly' as const },
    { path: '/dream/how-it-works', priority: 0.8, changeFrequency: 'monthly' as const },
  ];

  /* ── Industry pages ───────────────────────────────────────── */
  const industryPages = [
    { path: '/dream/industries', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/dream/industries/financial-services', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/dream/industries/healthcare', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/dream/industries/government', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/dream/industries/retail', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/dream/industries/technology-sector', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/dream/industries/professional-services', priority: 0.7, changeFrequency: 'monthly' as const },
  ];

  /* ── Use case pages ───────────────────────────────────────── */
  const useCasePages = [
    { path: '/dream/use-cases', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/dream/use-cases/enterprise-ai-adoption', priority: 0.9, changeFrequency: 'monthly' as const },
  ];

  /* ── Static pages ─────────────────────────────────────────── */
  const staticPages = [
    { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' as const },
  ];

  return [...corePages, ...industryPages, ...useCasePages, ...staticPages].map((page) => ({
    url: `${SITE_URL}${page.path}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}

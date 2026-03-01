import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://dream.ethenta.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/dream/',
        disallow: [
          '/api/',
          '/admin/',
          '/login',
          '/forgot-password',
          '/reset-password',
          '/tenant/',
          '/sales/',
          '/discovery/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

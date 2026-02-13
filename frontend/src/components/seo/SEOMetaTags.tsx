import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOMetaTagsProps {
  title?: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
  ogType?: 'website' | 'article' | 'profile';
  twitterCard?: 'summary' | 'summary_large_image';
  canonicalUrl?: string;
  noIndex?: boolean;
  structuredData?: object;
}

const SEOMetaTags: React.FC<SEOMetaTagsProps> = ({
  title = 'AI CFO - Your AI-Powered Financial Intelligence Platform',
  description = 'Stop guessing about your finances. Get clear visibility into cash health, revenue trends, and expenses with AI insights that help Indian SMEs make confident financial decisions.',
  keywords = [
    'AI CFO',
    'financial intelligence',
    'cash flow management',
    'revenue analytics',
    'expense tracking',
    'Tally integration',
    'Indian SMEs',
    'financial dashboard',
    'AI insights',
    'business finance',
    'cash runway',
    'financial decisions',
    'SME finance',
    'startup finance',
    'financial planning'
  ],
  ogImage = '/og-image.jpg',
  ogType = 'website',
  twitterCard = 'summary_large_image',
  canonicalUrl,
  noIndex = false,
  structuredData,
}) => {
  const siteName = 'AI CFO';
  const siteUrl = 'https://aicfo.in';
  const fullTitle = title === siteName ? title : `${title} | ${siteName}`;
  const fullCanonicalUrl = canonicalUrl ? `${siteUrl}${canonicalUrl}` : siteUrl;
  const fullOgImage = ogImage.startsWith('http') ? ogImage : `${siteUrl}${ogImage}`;

  // Default structured data for organization
  const defaultStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'AI CFO',
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    description: 'AI-powered financial intelligence platform for Indian SMEs',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'IN',
      addressRegion: 'India',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+91-XXXXXXXXXX',
      contactType: 'customer service',
      areaServed: 'IN',
      availableLanguage: ['English', 'Hindi'],
    },
    sameAs: [
      'https://twitter.com/aicfo',
      'https://linkedin.com/company/aicfo',
      'https://facebook.com/aicfo',
    ],
  };

  const finalStructuredData = structuredData || defaultStructuredData;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords.join(', ')} />
      <meta name="author" content="AI CFO Team" />
      <meta name="robots" content={noIndex ? 'noindex,nofollow' : 'index,follow'} />
      <meta name="googlebot" content={noIndex ? 'noindex,nofollow' : 'index,follow'} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={fullCanonicalUrl} />
      
      {/* Open Graph Meta Tags */}
      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={fullCanonicalUrl} />
      <meta property="og:image" content={fullOgImage} />
      <meta property="og:image:alt" content="AI CFO Platform Preview" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content="en_IN" />
      
      {/* Twitter Card Meta Tags */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:site" content="@aicfo" />
      <meta name="twitter:creator" content="@aicfo" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullOgImage} />
      <meta name="twitter:image:alt" content="AI CFO Platform Preview" />
      
      {/* Additional SEO Meta Tags */}
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="theme-color" content="#0ea5e9" />
      <meta name="msapplication-TileColor" content="#0ea5e9" />
      <meta name="msapplication-TileImage" content="/mstile-144x144.png" />
      
      {/* Language and Region */}
      <html lang="en" />
      <meta property="og:locale:alternate" content="hi_IN" />
      
      {/* Article Specific Meta Tags (if applicable) */}
      {ogType === 'article' && (
        <>
          <meta property="article:author" content="AI CFO Team" />
          <meta property="article:publisher" content="AI CFO" />
          <meta property="article:section" content="Finance" />
          <meta property="article:tag" content={keywords.join(', ')} />
        </>
      )}
      
      {/* Structured Data */}
      {finalStructuredData && (
        <script type="application/ld+json">
          {JSON.stringify(finalStructuredData)}
        </script>
      )}
      
      {/* Preconnect to external domains */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="//www.google-analytics.com" />
      <link rel="dns-prefetch" href="//www.googletagmanager.com" />
      
      {/* Favicon */}
      <link rel="icon" type="image/x-icon" href="/favicon.ico" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      <link rel="manifest" href="/site.webmanifest" />
    </Helmet>
  );
};

export default SEOMetaTags;
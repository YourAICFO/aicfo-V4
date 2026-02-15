/**
 * Sitemap and robots.txt generation utilities for AI CFO
 * Generates SEO-friendly sitemaps and robots.txt files
 */

export interface SitemapEntry {
  url: string;
  lastModified?: string;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

export interface SitemapConfig {
  baseUrl: string;
  entries: SitemapEntry[];
}

export interface RobotsTxtConfig {
  userAgent?: string;
  allow?: string[];
  disallow?: string[];
  sitemap?: string;
  crawlDelay?: number;
}

/**
 * Generate XML sitemap
 */
export const generateSitemapXML = (config: SitemapConfig): string => {
  const { baseUrl, entries } = config;
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(entry => {
  const fullUrl = entry.url.startsWith('http') ? entry.url : `${baseUrl}${entry.url}`;
  const lastmod = entry.lastModified ? `<lastmod>${entry.lastModified}</lastmod>` : '';
  const changefreq = entry.changeFrequency ? `<changefreq>${entry.changeFrequency}</changefreq>` : '';
  const priority = entry.priority ? `<priority>${entry.priority}</priority>` : '';
  
  return `  <url>
    <loc>${fullUrl}</loc>${lastmod}${changefreq}${priority}
  </url>`;
}).join('\n')}
</urlset>`;

  return xml;
};

/**
 * Generate robots.txt content
 */
export const generateRobotsTxt = (config: RobotsTxtConfig): string => {
  const {
    userAgent = '*',
    allow = ['/'],
    disallow = ['/admin', '/api/private'],
    sitemap = '/sitemap.xml',
    crawlDelay
  } = config;

  let content = `User-agent: ${userAgent}\n`;

  // Add allow directives
  allow.forEach(path => {
    content += `Allow: ${path}\n`;
  });

  // Add disallow directives
  disallow.forEach(path => {
    content += `Disallow: ${path}\n`;
  });

  // Add crawl delay if specified
  if (crawlDelay) {
    content += `Crawl-delay: ${crawlDelay}\n`;
  }

  // Add sitemap
  if (sitemap) {
    content += `\nSitemap: ${sitemap}\n`;
  }

  return content;
};

/**
 * Default sitemap configuration for AI CFO
 */
export const getDefaultSitemapConfig = (): SitemapConfig => {
  const baseUrl = 'https://aicfo.in';
  const currentDate = new Date().toISOString().split('T')[0];

  return {
    baseUrl,
    entries: [
      { url: '/', lastModified: currentDate, changeFrequency: 'weekly', priority: 1.0 },
      { url: '/features', lastModified: currentDate, changeFrequency: 'monthly', priority: 0.8 },
      { url: '/pricing', lastModified: currentDate, changeFrequency: 'monthly', priority: 0.8 },
      { url: '/about', lastModified: currentDate, changeFrequency: 'monthly', priority: 0.7 },
      { url: '/contact', lastModified: currentDate, changeFrequency: 'yearly', priority: 0.6 },
      { url: '/privacy', lastModified: currentDate, changeFrequency: 'yearly', priority: 0.5 },
      { url: '/terms', lastModified: currentDate, changeFrequency: 'yearly', priority: 0.5 },
      { url: '/blog', lastModified: currentDate, changeFrequency: 'weekly', priority: 0.7 },
      { url: '/blog/cash-flow-management', lastModified: currentDate, changeFrequency: 'monthly', priority: 0.6 },
      { url: '/blog/ai-in-finance', lastModified: currentDate, changeFrequency: 'monthly', priority: 0.6 },
      { url: '/login', lastModified: currentDate, changeFrequency: 'yearly', priority: 0.4 },
      { url: '/register', lastModified: currentDate, changeFrequency: 'yearly', priority: 0.4 },
      { url: '/demo', lastModified: currentDate, changeFrequency: 'monthly', priority: 0.7 },
    ]
  };
};

/**
 * Default robots.txt configuration for AI CFO
 */
export const getDefaultRobotsTxtConfig = (): RobotsTxtConfig => {
  return {
    userAgent: '*',
    allow: ['/'],
    disallow: [
      '/admin',
      '/api/private',
      '/api/internal',
      '/_next',
      '/static',
      '/favicon.ico',
      '/robots.txt',
      '/sitemap.xml'
    ],
    sitemap: 'https://aicfo.in/sitemap.xml',
    crawlDelay: 1
  };
};

/**
 * Generate HTML sitemap for better user navigation
 */
export const generateHTMLSitemap = (config: SitemapConfig): string => {
  const { baseUrl, entries } = config;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sitemap - AI CFO</title>
  <meta name="description" content="Complete sitemap of AI CFO website for easy navigation">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #1f2937; }
    .sitemap-list { list-style: none; padding: 0; }
    .sitemap-item { margin: 10px 0; }
    .sitemap-link { color: #3b82f6; text-decoration: none; }
    .sitemap-link:hover { text-decoration: underline; }
    .last-modified { font-size: 0.875rem; color: #6b7280; }
    .priority { font-size: 0.875rem; color: #059669; }
  </style>
</head>
<body>
  <h1>AI CFO Sitemap</h1>
  <p>Welcome to AI CFO! Here's a complete list of all pages on our website:</p>
  
  <ul class="sitemap-list">
    ${entries.map(entry => {
      const fullUrl = entry.url.startsWith('http') ? entry.url : `${baseUrl}${entry.url}`;
      const pageTitle = getPageTitle(entry.url);
      const lastmod = entry.lastModified ? `<span class="last-modified">Last updated: ${entry.lastModified}</span>` : '';
      const priority = entry.priority ? `<span class="priority">Priority: ${entry.priority}</span>` : '';
      
      return `<li class="sitemap-item">
        <a href="${fullUrl}" class="sitemap-link">${pageTitle}</a>
        ${lastmod}
        ${priority}
      </li>`;
    }).join('')}
  </ul>
  
  <p style="margin-top: 40px; font-size: 0.875rem; color: #6b7280;">
    This sitemap was last updated on ${new Date().toLocaleDateString()}
  </p>
</body>
</html>
  `;
};

/**
 * Get human-readable page title from URL
 */
const getPageTitle = (url: string): string => {
  const titles: Record<string, string> = {
    '/': 'AI CFO - AI-Powered Financial Intelligence Platform',
    '/features': 'Features - AI CFO',
    '/pricing': 'Pricing - AI CFO',
    '/about': 'About Us - AI CFO',
    '/contact': 'Contact Us - AI CFO',
    '/privacy': 'Privacy Policy - AI CFO',
    '/terms': 'Terms of Service - AI CFO',
    '/blog': 'Blog - AI CFO Financial Insights',
    '/blog/cash-flow-management': 'Cash Flow Management Guide - AI CFO Blog',
    '/blog/ai-in-finance': 'AI in Finance - AI CFO Blog',
    '/login': 'Login - AI CFO',
    '/register': 'Register - AI CFO',
    '/demo': 'Demo - AI CFO',
  };
  
  return titles[url] || url;
};

/**
 * Validate sitemap entries
 */
export const validateSitemapEntries = (entries: SitemapEntry[]): boolean => {
  return entries.every(entry => {
    // Validate URL format
    if (!entry.url || entry.url.length === 0) return false;
    
    // Validate priority (0.0 to 1.0)
    if (entry.priority !== undefined && (entry.priority < 0 || entry.priority > 1)) return false;
    
    // Validate change frequency
    const validFrequencies = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];
    if (entry.changeFrequency && !validFrequencies.includes(entry.changeFrequency)) return false;
    
    // Validate last modified date format (YYYY-MM-DD)
    if (entry.lastModified && !/^\d{4}-\d{2}-\d{2}$/.test(entry.lastModified)) return false;
    
    return true;
  });
};

/**
 * Generate dynamic sitemap based on user content
 */
export const generateDynamicSitemap = (userContent: {
  blogPosts?: Array<{ slug: string; updatedAt: string }>;
  companies?: Array<{ id: string; updatedAt: string }>;
}): SitemapEntry[] => {
  const entries: SitemapEntry[] = [];

  // Add blog posts
  if (userContent.blogPosts) {
    userContent.blogPosts.forEach(post => {
      entries.push({
        url: `/blog/${post.slug}`,
        lastModified: post.updatedAt.split('T')[0],
        changeFrequency: 'monthly',
        priority: 0.6
      });
    });
  }

  // Add company pages (if public)
  if (userContent.companies) {
    userContent.companies.forEach(company => {
      entries.push({
        url: `/company/${company.id}`,
        lastModified: company.updatedAt.split('T')[0],
        changeFrequency: 'weekly',
        priority: 0.5
      });
    });
  }

  return entries;
};

/**
 * Submit sitemap to search engines
 */
export const submitToSearchEngines = async (sitemapUrl: string): Promise<void> => {
  const searchEngines = [
    `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
    `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
  ];

  try {
    // Submit to Google and Bing
    await Promise.all(
      searchEngines.map(url => 
        fetch(url, { method: 'GET' })
          .then(response => {
            if (!response.ok) {
              console.warn(`Failed to submit sitemap to ${url}: ${response.status}`);
            }
          })
          .catch(error => {
            console.warn(`Error submitting sitemap to ${url}:`, error);
          })
      )
    );
    
    console.log('Sitemap submitted to search engines successfully');
  } catch (error) {
    console.error('Error submitting sitemap to search engines:', error);
  }
};

/**
 * Create sitemap index for large websites
 */
export const generateSitemapIndex = (sitemaps: string[], baseUrl: string): string => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.map(sitemap => {
  const fullUrl = sitemap.startsWith('http') ? sitemap : `${baseUrl}${sitemap}`;
  const lastmod = new Date().toISOString().split('T')[0];
  
  return `  <sitemap>
    <loc>${fullUrl}</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`;
}).join('\n')}
</sitemapindex>`;
};

export default {
  generateSitemapXML,
  generateRobotsTxt,
  generateHTMLSitemap,
  generateDynamicSitemap,
  generateSitemapIndex,
  getDefaultSitemapConfig,
  getDefaultRobotsTxtConfig,
  submitToSearchEngines,
  validateSitemapEntries
};

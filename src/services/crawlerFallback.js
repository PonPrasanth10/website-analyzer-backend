const axios = require('axios');
const cheerio = require('cheerio');

// Fallback crawler without Puppeteer (for environments without Chrome)
async function crawlWebsiteFallback(url) {
  try {
    console.log('Using fallback crawler (no Puppeteer)');
    
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const html = response.data;
    const $ = cheerio.load(html);

    const crawlData = {
      title: $('title').text().trim(),
      description: $('meta[name="description"]').attr('content') || '',
      h1: $('h1').map((_, el) => $(el).text().trim()).get(),
      h2: $('h2').map((_, el) => $(el).text().trim()).get(),
      h3: $('h3').map((_, el) => $(el).text().trim()).get(),
      images: {
        total: $('img').length,
        missingAlt: $('img:not([alt]), img[alt=""]').length,
      },
      links: {
        internal: $('a[href]').filter((_, el) => {
          const href = $(el).attr('href') || '';
          return href.startsWith('/') || href.includes(new URL(url).hostname);
        }).length,
        external: $('a[href]').filter((_, el) => {
          const href = $(el).attr('href') || '';
          return href.startsWith('http') && !href.includes(new URL(url).hostname);
        }).length,
      },
      bodyText: $('body').text().replace(/\s+/g, ' ').trim().slice(0, 5000),
      wordCount: $('body').text().trim().split(/\s+/).length,
      hasViewportMeta: !!$('meta[name="viewport"]').length,
      ctaButtons: $('button, a').filter((_, el) => {
        const text = $(el).text().toLowerCase();
        return /get started|sign up|try|buy|subscribe|free|start|join|learn more/.test(text);
      }).map((_, el) => $(el).text().trim()).get().slice(0, 10),
      structuredData: !!$('script[type="application/ld+json"]').length,
      canonicalUrl: $('link[rel="canonical"]').attr('href') || '',
      ogTags: {
        title: $('meta[property="og:title"]').attr('content') || '',
        description: $('meta[property="og:description"]').attr('content') || '',
        image: $('meta[property="og:image"]').attr('content') || '',
      },
    };

    return { 
      screenshot: null, // No screenshot in fallback mode
      crawlData 
    };
  } catch (error) {
    throw new Error(`Fallback crawl failed: ${error.message}`);
  }
}

module.exports = { crawlWebsiteFallback };
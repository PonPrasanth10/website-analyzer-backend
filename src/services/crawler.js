const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');

async function crawlWebsite(url) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Give JS-heavy pages a moment to render
    await new Promise((r) => setTimeout(r, 2000));

    const screenshot = await page.screenshot({ encoding: 'base64', fullPage: false });
    const html = await page.content();

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

    return { screenshot, crawlData };
  } finally {
    if (browser) await browser.close();
  }
}

async function runLighthouse(url) {
  try {
    const { default: lighthouse } = await import('lighthouse');
    const { launch } = await import('chrome-launcher');

    const chrome = await launch({
      chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    });

    let runnerResult;
    try {
      runnerResult = await lighthouse(url, {
        logLevel: 'error',
        output: 'json',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        port: chrome.port,
      });
    } finally {
      await chrome.kill();
    }

    const cats = runnerResult.lhr.categories;
    const audits = runnerResult.lhr.audits;

    return {
      performance: Math.round((cats.performance?.score || 0) * 100),
      accessibility: Math.round((cats.accessibility?.score || 0) * 100),
      bestPractices: Math.round((cats['best-practices']?.score || 0) * 100),
      seo: Math.round((cats.seo?.score || 0) * 100),
      metrics: {
        lcp: audits['largest-contentful-paint']?.numericValue || 0,
        cls: audits['cumulative-layout-shift']?.numericValue || 0,
        fid: audits['max-potential-fid']?.numericValue || 0,
        fcp: audits['first-contentful-paint']?.numericValue || 0,
        ttfb: audits['server-response-time']?.numericValue || 0,
        speedIndex: audits['speed-index']?.numericValue || 0,
      },
    };
  } catch (err) {
    console.error('Lighthouse error:', err.message);
    return null;
  }
}

module.exports = { crawlWebsite, runLighthouse };

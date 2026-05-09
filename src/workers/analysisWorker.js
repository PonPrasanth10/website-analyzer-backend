const Report = require('../models/Report');
const { crawlWebsite, runLighthouse } = require('../services/crawler');
const { crawlWebsiteFallback } = require('../services/crawlerFallback');
const { analyzeWithAI, analyzeScreenshotWithVision } = require('../services/aiAnalysis');

async function processAnalysisJob(job) {
  const { reportId, url } = job.data;

  await Report.findByIdAndUpdate(reportId, { status: 'processing' });

  try {
    let screenshot, crawlData, lighthouseData;

    // Try Puppeteer first, fallback if Chrome is not available
    try {
      console.log(`[Job ${job.id}] Crawling ${url} with Puppeteer`);
      const result = await crawlWebsite(url);
      screenshot = result.screenshot;
      crawlData = result.crawlData;
    } catch (puppeteerError) {
      console.log(`[Job ${job.id}] Puppeteer failed, using fallback crawler:`, puppeteerError.message);
      const result = await crawlWebsiteFallback(url);
      screenshot = result.screenshot;
      crawlData = result.crawlData;
    }

    // Try Lighthouse, skip if Chrome is not available
    try {
      console.log(`[Job ${job.id}] Running Lighthouse`);
      lighthouseData = await runLighthouse(url);
    } catch (lighthouseError) {
      console.log(`[Job ${job.id}] Lighthouse failed, skipping:`, lighthouseError.message);
      lighthouseData = null;
    }

    // Step 3: AI Text Analysis
    console.log(`[Job ${job.id}] Running AI analysis`);
    const [aiAnalysis, visionAnalysis] = await Promise.all([
      analyzeWithAI(crawlData, lighthouseData),
      analyzeScreenshotWithVision(screenshot, url, crawlData),
    ]);

    // Merge vision scores into aiAnalysis if available
    const finalAnalysis = aiAnalysis ? {
      ...aiAnalysis,
      visionAnalysis: visionAnalysis || null,
    } : null;

    await Report.findByIdAndUpdate(reportId, {
      status: 'completed',
      screenshot,
      crawlData,
      lighthouse: lighthouseData,
      aiAnalysis: finalAnalysis,
    });

    console.log(`[Job ${job.id}] Completed`);
  } catch (err) {
    console.error(`[Job ${job.id}] Failed:`, err.message);
    await Report.findByIdAndUpdate(reportId, {
      status: 'failed',
      error: err.message,
    });
    // Do NOT re-throw — direct execution has no Bull to catch it, causing process crash
  }
}

module.exports = { processAnalysisJob };

const Report = require('../models/Report');
const { crawlWebsite, runLighthouse } = require('../services/crawler');
const { analyzeWithAI, analyzeScreenshotWithVision } = require('../services/aiAnalysis');

async function processAnalysisJob(job) {
  const { reportId, url } = job.data;

  await Report.findByIdAndUpdate(reportId, { status: 'processing' });

  try {
    // Step 1: Crawl
    console.log(`[Job ${job.id}] Crawling ${url}`);
    const { screenshot, crawlData } = await crawlWebsite(url);

    // Step 2: Lighthouse (run in parallel with AI prep)
    console.log(`[Job ${job.id}] Running Lighthouse`);
    const lighthouseData = await runLighthouse(url);

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

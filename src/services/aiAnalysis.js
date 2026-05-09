const axios = require('axios');
const Groq = require('groq-sdk');

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

// ── Groq (primary) ────────────────────────────────────────────────────────────
async function callGroq(prompt) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 4096,
  });
  const text = completion.choices[0]?.message?.content || '';
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  return JSON.parse(jsonMatch[1].trim());
}

// ── Gemini (fallback) ─────────────────────────────────────────────────────────
async function callGemini(prompt, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.post(
        `${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`,
        { contents: [{ parts: [{ text: prompt }] }] },
        { headers: { 'Content-Type': 'application/json' }, timeout: 60000 }
      );
      const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
      return JSON.parse(jsonMatch[1].trim());
    } catch (err) {
      if (err.response?.status === 429 && i < retries - 1) {
        const wait = Math.pow(2, i) * 5000;
        console.log(`Gemini rate limited. Retrying in ${wait / 1000}s...`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw new Error(err.response?.data?.error?.message || err.message);
    }
  }
}

// ── Primary + fallback orchestrator ──────────────────────────────────────────
async function callLLM(prompt) {
  if (process.env.GROQ_API_KEY) {
    try {
      return await callGroq(prompt);
    } catch (err) {
      console.warn('Groq failed, falling back to Gemini:', err.message);
    }
  }
  if (process.env.GEMINI_API_KEY) {
    return await callGemini(prompt);
  }
  throw new Error('No LLM API key configured (GROQ_API_KEY or GEMINI_API_KEY)');
}

// ── Text analysis ─────────────────────────────────────────────────────────────
async function analyzeWithAI(crawlData, lighthouseData) {
  try {
    const seoContext = `
URL Analysis Data:
- Title: "${crawlData.title}" (${crawlData.title?.length || 0} chars)
- Meta Description: "${crawlData.description}" (${crawlData.description?.length || 0} chars)
- H1 tags: ${JSON.stringify(crawlData.h1)}
- H2 tags: ${JSON.stringify(crawlData.h2?.slice(0, 5))}
- Images: ${crawlData.images?.total} total, ${crawlData.images?.missingAlt} missing alt text
- Word count: ${crawlData.wordCount}
- Internal links: ${crawlData.links?.internal}, External: ${crawlData.links?.external}
- Has viewport meta: ${crawlData.hasViewportMeta}
- Has structured data: ${crawlData.structuredData}
- Canonical URL: ${crawlData.canonicalUrl}
- OG Tags: ${JSON.stringify(crawlData.ogTags)}
- CTA Buttons found: ${JSON.stringify(crawlData.ctaButtons)}
- Body text sample: "${crawlData.bodyText?.slice(0, 1500)}"
`;

    const lighthouseContext = lighthouseData ? `
Lighthouse Scores:
- Performance: ${lighthouseData.performance}/100
- Accessibility: ${lighthouseData.accessibility}/100
- Best Practices: ${lighthouseData.bestPractices}/100
- SEO: ${lighthouseData.seo}/100
- LCP: ${(lighthouseData.metrics?.lcp / 1000).toFixed(2)}s
- CLS: ${lighthouseData.metrics?.cls?.toFixed(3)}
- FCP: ${(lighthouseData.metrics?.fcp / 1000).toFixed(2)}s
- TTFB: ${(lighthouseData.metrics?.ttfb / 1000).toFixed(2)}s
` : 'Lighthouse data unavailable.';

    const prompt = `You are a senior UX/SEO/conversion consultant and web performance expert.

Analyze this website data and return a comprehensive audit report as valid JSON.

${seoContext}
${lighthouseContext}

Return ONLY valid JSON (no markdown, no explanation) in this exact structure:
{
  "uiScore": <0-100>,
  "uxScore": <0-100>,
  "seoScore": <0-100>,
  "conversionScore": <0-100>,
  "accessibilityScore": <0-100>,
  "overallScore": <0-100>,
  "executiveSummary": "<2 sentence summary of the website's current state and biggest opportunity>",
  "highPriorityIssues": [
    { "title": "<issue title>", "description": "<specific actionable description>", "impact": "<business impact>" }
  ],
  "mediumPriorityIssues": [
    { "title": "<issue title>", "description": "<specific actionable description>", "impact": "<business impact>" }
  ],
  "quickWins": ["<fix under 1 hour>", "<fix under 1 hour>", "<fix under 1 hour>"],
  "seoRecommendations": {
    "suggestedTitle": "<optimized title tag under 60 chars>",
    "suggestedDescription": "<optimized meta description 150-160 chars>",
    "headingIssues": ["<specific heading issue>"]
  },
  "conversionTips": [
    { "original": "<current CTA or copy>", "improved": "<better version>", "reason": "<why this converts better>" }
  ],
  "redesignSuggestions": ["<specific UI/visual improvement>"],
  "roadmap": [
    { "phase": "Week 1 - Quick Wins", "actions": ["<action>"] },
    { "phase": "Month 1 - Core Improvements", "actions": ["<action>"] },
    { "phase": "Quarter 1 - Strategic Growth", "actions": ["<action>"] }
  ]
}

Be specific, not generic. Reference actual content from the data. Max 3 high priority, 4 medium priority issues.`;

    return await callLLM(prompt);
  } catch (err) {
    console.error('AI text analysis error:', err.message);
    return null;
  }
}

// ── Vision analysis (using Groq with crawl data — text-based visual analysis) ─
async function analyzeScreenshotWithVision(screenshotBase64, url, crawlData) {
  try {
    const prompt = `You are a senior UI/UX designer analyzing a website for ${url}.

Based on this page data, provide a visual design assessment:
- Page title: "${crawlData?.title}"
- H1 headings: ${JSON.stringify(crawlData?.h1)}
- H2 headings: ${JSON.stringify(crawlData?.h2?.slice(0, 4))}
- Total images: ${crawlData?.images?.total}
- Has viewport meta: ${crawlData?.hasViewportMeta}
- OG image set: ${!!crawlData?.ogTags?.image}
- Body text sample: "${crawlData?.bodyText?.slice(0, 500)}"

Return ONLY valid JSON:
{
  "visualAppealScore": <0-100>,
  "designModernityScore": <0-100>,
  "brandingConsistencyScore": <0-100>,
  "visualFeedback": ["<specific visual observation>"],
  "colorPaletteAssessment": "<assessment of likely color usage based on brand/content>",
  "typographyAssessment": "<assessment of typography based on headings and content>",
  "layoutAssessment": "<assessment of layout and hierarchy based on structure>",
  "modernizationTips": ["<specific UI modernization tip>"]
}`;
    return await callLLM(prompt);
  } catch (err) {
    console.error('Vision analysis error:', err.message);
    return null;
  }
}

module.exports = { analyzeWithAI, analyzeScreenshotWithVision };

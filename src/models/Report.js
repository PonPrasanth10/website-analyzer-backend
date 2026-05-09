const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  url: { type: String, required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  jobId: String,
  screenshot: String, // base64 or path
  crawlData: {
    title: String,
    description: String,
    h1: [String],
    h2: [String],
    h3: [String],
    images: { total: Number, missingAlt: Number },
    links: { internal: Number, external: Number },
    bodyText: String,
    wordCount: Number,
  },
  lighthouse: {
    performance: Number,
    accessibility: Number,
    bestPractices: Number,
    seo: Number,
    metrics: {
      lcp: Number,
      cls: Number,
      fid: Number,
      fcp: Number,
      ttfb: Number,
      speedIndex: Number,
    }
  },
  aiAnalysis: {
    uiScore: Number,
    uxScore: Number,
    seoScore: Number,
    conversionScore: Number,
    accessibilityScore: Number,
    overallScore: Number,
    executiveSummary: String,
    highPriorityIssues: [{ title: String, description: String, impact: String }],
    mediumPriorityIssues: [{ title: String, description: String, impact: String }],
    quickWins: [String],
    seoRecommendations: { suggestedTitle: String, suggestedDescription: String, headingIssues: [String] },
    conversionTips: [{ original: String, improved: String, reason: String }],
    redesignSuggestions: [String],
    roadmap: [{ phase: String, actions: [String] }],
  },
  error: String,
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);

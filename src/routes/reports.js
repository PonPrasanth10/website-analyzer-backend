const router = require('express').Router();
const Report = require('../models/Report');
const auth = require('../middleware/auth');

// GET /api/reports — list user's reports
router.get('/', auth, async (req, res) => {
  try {
    const reports = await Report.find({ userId: req.user.id })
      .select('url status createdAt aiAnalysis.overallScore aiAnalysis.uiScore aiAnalysis.seoScore lighthouse')
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/reports/:id — get full report
router.get('/:id', auth, async (req, res) => {
  try {
    const report = await Report.findOne({ _id: req.params.id, userId: req.user.id });
    if (!report) return res.status(404).json({ message: 'Report not found' });
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/reports/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await Report.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

const router = require('express').Router();
const Report = require('../models/Report');
const auth = require('../middleware/auth');
const { enqueueOrProcess } = require('../services/queue');

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// POST /api/analyze — start analysis
router.post('/', auth, async (req, res) => {
  try {
    let { url } = req.body;
    if (!url) return res.status(400).json({ message: 'URL is required' });
    if (!url.startsWith('http')) url = 'https://' + url;
    if (!isValidUrl(url)) return res.status(400).json({ message: 'Invalid URL' });

    const report = await Report.create({ userId: req.user.id, url, status: 'pending' });
    const jobId = await enqueueOrProcess(report._id.toString(), url);

    await Report.findByIdAndUpdate(report._id, { jobId: jobId.toString() });

    res.status(202).json({ reportId: report._id, jobId, status: 'pending' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/analyze/:reportId/status — poll job status
router.get('/:reportId/status', auth, async (req, res) => {
  try {
    const report = await Report.findOne({ _id: req.params.reportId, userId: req.user.id })
      .select('status error url createdAt');
    if (!report) return res.status(404).json({ message: 'Report not found' });
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

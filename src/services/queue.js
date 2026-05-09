const { processAnalysisJob } = require('../workers/analysisWorker');

let queue = null;

function tryInitQueue() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl || redisUrl.includes('localhost')) return null; // skip if local/unset

  try {
    const Bull = require('bull');
    const q = new Bull('analysis', redisUrl, {
      redis: { enableOfflineQueue: false, connectTimeout: 3000, maxRetriesPerRequest: 1, lazyConnect: true },
    });
    q.process(2, processAnalysisJob);
    q.on('error', () => {}); // silence — we fall back gracefully
    return q;
  } catch {
    return null;
  }
}

async function enqueueOrProcess(reportId, url) {
  if (!queue) queue = tryInitQueue();

  if (queue) {
    try {
      const job = await queue.add({ reportId, url }, { attempts: 2, backoff: 5000 });
      return job.id;
    } catch {
      // fall through to direct
    }
  }

  // Direct in-process execution (no Redis needed)
  setImmediate(() => processAnalysisJob({ id: 'direct', data: { reportId, url } }));
  return 'direct';
}

module.exports = { enqueueOrProcess };

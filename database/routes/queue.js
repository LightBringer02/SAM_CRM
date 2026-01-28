/**
 * Queue Routes
 * REST API for queue management - ROOT and ADMIN access
 * Note: ROOT users have full access, ADMIN users can manage queue
 */

const express = require('express');
const router = express.Router();

// Import queue and auth modules
const { extractUser, requireAdmin } = require('../../backend/middleware/authMiddleware');
const queueManager = require('../queue/queue_manager');
const worker = require('../queue/worker');

// Apply auth middleware - ROOT and ADMIN can access queue management
router.use(extractUser);
router.use(requireAdmin);

/**
 * GET /api/queue/status
 * Get queue status and statistics
 */
router.get('/status', async (req, res) => {
  try {
    const stats = await queueManager.getQueueStats();
    const workerStatus = worker.getStatus();
    
    res.json({
      success: true,
      data: {
        queue: stats,
        worker: workerStatus
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/queue/jobs
 * List queue jobs with optional filtering
 */
router.get('/jobs', async (req, res) => {
  try {
    const { status, taskType, limit = 50 } = req.query;
    
    const jobs = await queueManager.getJobs({
      status,
      taskType,
      limit: parseInt(limit)
    });
    
    res.json({
      success: true,
      data: jobs,
      count: jobs.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/queue/jobs/:id
 * Get single job details with logs
 */
router.get('/jobs/:id', async (req, res) => {
  try {
    const job = await queueManager.getJob(req.params.id);
    
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    
    const logs = await queueManager.getJobLogs(req.params.id);
    
    res.json({
      success: true,
      data: { ...job, logs }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/queue/jobs/:id/cancel
 * Cancel a pending or processing job
 */
router.post('/jobs/:id/cancel', async (req, res) => {
  try {
    const result = await queueManager.cancelJob(req.params.id);
    
    if (!result) {
      return res.status(404).json({ success: false, error: 'Job not found or cannot be cancelled' });
    }
    
    res.json({
      success: true,
      message: 'Job cancelled',
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/queue/enqueue/fetch
 * Enqueue a Tally fetch job
 */
router.post('/enqueue/fetch', async (req, res) => {
  try {
    const { fetchType = 'all' } = req.body;
    const job = await queueManager.enqueueFetch(fetchType, req.user?.username || 'root');
    
    res.json({
      success: true,
      message: 'Fetch job enqueued',
      data: job
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/queue/enqueue/sync
 * Enqueue a CRM → PostgreSQL sync job
 */
router.post('/enqueue/sync', async (req, res) => {
  try {
    const job = await queueManager.enqueueSync(req.body, req.user?.username || 'root');
    
    res.json({
      success: true,
      message: 'Sync job enqueued',
      data: job
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/queue/enqueue/backup
 * Enqueue a backup job
 */
router.post('/enqueue/backup', async (req, res) => {
  try {
    const { backupType = 'full', description } = req.body;
    const job = await queueManager.enqueueBackup(
      { backupType, description },
      req.user?.username || 'root'
    );
    
    res.json({
      success: true,
      message: 'Backup job enqueued',
      data: job
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/queue/flush
 * Cancel all pending jobs (flush queue)
 */
router.post('/flush', async (req, res) => {
  try {
    const result = await queueManager.flushQueue();
    
    res.json({
      success: true,
      message: `Flushed ${result.flushedCount} pending jobs`,
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/queue/cleanup
 * Cleanup old completed jobs
 */
router.post('/cleanup', async (req, res) => {
  try {
    const { retentionDays = 30 } = req.body;
    const result = await queueManager.cleanupOldJobs(retentionDays);
    
    res.json({
      success: true,
      message: `Cleaned up ${result.deletedCount} old jobs`,
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/queue/worker/start
 * Start the queue worker
 */
router.post('/worker/start', (req, res) => {
  try {
    worker.start();
    
    res.json({
      success: true,
      message: 'Worker started',
      data: worker.getStatus()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/queue/worker/stop
 * Stop the queue worker
 */
router.post('/worker/stop', async (req, res) => {
  try {
    await worker.stop();
    
    res.json({
      success: true,
      message: 'Worker stopped',
      data: worker.getStatus()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/queue/worker/pause
 * Pause the queue worker
 */
router.post('/worker/pause', (req, res) => {
  try {
    worker.pause();
    
    res.json({
      success: true,
      message: 'Worker paused',
      data: worker.getStatus()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/queue/worker/resume
 * Resume the queue worker
 */
router.post('/worker/resume', (req, res) => {
  try {
    worker.resume();
    
    res.json({
      success: true,
      message: 'Worker resumed',
      data: worker.getStatus()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

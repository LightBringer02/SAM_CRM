/**
 * Queue Worker
 * Processes jobs from the queue asynchronously
 * Supports graceful shutdown and configurable concurrency
 */

const { 
  dequeue, 
  completeJob, 
  failJob, 
  logJobEvent,
  TASK_TYPES 
} = require('./queue_manager');

// Import task handlers
const tallySyncTask = require('./tasks/tally_sync_task');
const crmToPostgresTask = require('./tasks/crm_to_postgres_task');
const backupTask = require('./tasks/backup_task');

// Worker state
let isRunning = false;
let isPaused = false;
let currentJob = null;
let processedCount = 0;
let failedCount = 0;
let pollInterval = null;

// Configuration
const CONFIG = {
  pollIntervalMs: 1000,       // How often to check for new jobs
  maxConcurrent: 1,           // Max concurrent jobs (keep at 1 for now)
  shutdownTimeoutMs: 30000,   // Max time to wait for job to complete on shutdown
};

/**
 * Map task types to their handlers
 */
const taskHandlers = {
  [TASK_TYPES.TALLY_SYNC]: tallySyncTask.execute,
  [TASK_TYPES.FETCH_INVENTORY]: tallySyncTask.fetchInventory,
  [TASK_TYPES.FETCH_VOUCHERS]: tallySyncTask.fetchVouchers,
  [TASK_TYPES.FETCH_LEDGERS]: tallySyncTask.fetchLedgers,
  [TASK_TYPES.CRM_TO_POSTGRES]: crmToPostgresTask.execute,
  [TASK_TYPES.BACKUP]: backupTask.executeBackup,
  [TASK_TYPES.RESTORE]: backupTask.executeRestore,
  [TASK_TYPES.FULL_SYNC]: async (payload) => {
    // Full sync: fetch from Tally then sync to PostgreSQL
    await tallySyncTask.execute(payload);
    await crmToPostgresTask.execute(payload);
    return { message: 'Full sync completed' };
  }
};

/**
 * Process a single job
 * @param {Object} job - Job object from queue
 */
async function processJob(job) {
  currentJob = job;
  const startTime = Date.now();

  console.log(`[Worker] Processing job ${job.id} (${job.task_type})`);
  await logJobEvent(job.id, 'info', 'Worker picked up job');

  try {
    // Get the handler for this task type
    const handler = taskHandlers[job.task_type];

    if (!handler) {
      throw new Error(`No handler registered for task type: ${job.task_type}`);
    }

    // Execute the task
    const result = await handler(job.payload);

    // Mark job as completed
    const duration = Date.now() - startTime;
    await completeJob(job.id, { ...result, duration });
    
    processedCount++;
    console.log(`[Worker] Job ${job.id} completed in ${duration}ms`);

  } catch (err) {
    console.error(`[Worker] Job ${job.id} failed:`, err.message);
    
    // Mark job as failed (will auto-retry if attempts < max_attempts)
    await failJob(job.id, err.message, true);
    failedCount++;

  } finally {
    currentJob = null;
  }
}

/**
 * Poll for and process jobs
 */
async function pollForJobs() {
  if (isPaused || !isRunning) {
    return;
  }

  try {
    // Attempt to dequeue a job
    const job = await dequeue();

    if (job) {
      await processJob(job);
    }

  } catch (err) {
    console.error('[Worker] Error polling for jobs:', err.message);
  }
}

/**
 * Start the queue worker
 * @param {Object} options - { pollIntervalMs }
 */
function start(options = {}) {
  if (isRunning) {
    console.log('[Worker] Already running');
    return;
  }

  const pollMs = options.pollIntervalMs || CONFIG.pollIntervalMs;
  
  console.log('[Worker] Starting queue worker...');
  isRunning = true;
  isPaused = false;

  // Start polling
  pollInterval = setInterval(pollForJobs, pollMs);
  
  // Immediate first poll
  pollForJobs();

  console.log(`[Worker] Queue worker started (polling every ${pollMs}ms)`);
}

/**
 * Stop the queue worker gracefully
 */
async function stop() {
  if (!isRunning) {
    console.log('[Worker] Not running');
    return;
  }

  console.log('[Worker] Stopping queue worker...');
  isRunning = false;

  // Clear polling interval
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }

  // Wait for current job to complete
  if (currentJob) {
    console.log('[Worker] Waiting for current job to complete...');
    
    const startWait = Date.now();
    while (currentJob && (Date.now() - startWait) < CONFIG.shutdownTimeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (currentJob) {
      console.warn('[Worker] Shutdown timeout reached, job may be orphaned');
    }
  }

  console.log('[Worker] Queue worker stopped');
}

/**
 * Pause job processing
 */
function pause() {
  if (!isRunning) {
    return;
  }
  
  isPaused = true;
  console.log('[Worker] Queue worker paused');
}

/**
 * Resume job processing
 */
function resume() {
  if (!isRunning) {
    return;
  }
  
  isPaused = false;
  console.log('[Worker] Queue worker resumed');
}

/**
 * Get worker status
 */
function getStatus() {
  return {
    isRunning,
    isPaused,
    hasCurrentJob: !!currentJob,
    currentJobId: currentJob?.id || null,
    currentJobType: currentJob?.task_type || null,
    processedCount,
    failedCount,
    pollIntervalMs: CONFIG.pollIntervalMs
  };
}

/**
 * Reset worker statistics
 */
function resetStats() {
  processedCount = 0;
  failedCount = 0;
}

/**
 * Register a custom task handler
 * @param {string} taskType - Task type name
 * @param {Function} handler - Async function to handle the task
 */
function registerHandler(taskType, handler) {
  if (typeof handler !== 'function') {
    throw new Error('Handler must be a function');
  }
  taskHandlers[taskType] = handler;
  console.log(`[Worker] Registered handler for task type: ${taskType}`);
}

// Handle process signals for graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Worker] SIGTERM received');
  await stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Worker] SIGINT received');
  await stop();
  process.exit(0);
});

module.exports = {
  start,
  stop,
  pause,
  resume,
  getStatus,
  resetStats,
  registerHandler,
  processJob // Exported for testing
};

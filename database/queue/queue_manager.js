/**
 * Queue Manager
 * Persistent job queue system using PostgreSQL
 * Handles job creation, retrieval, status updates, and cleanup
 */

const { query, transaction } = require('../sql/connection');
const { v4: uuidv4 } = require('uuid');

// Task types
const TASK_TYPES = {
  TALLY_SYNC: 'tally_sync',
  CRM_TO_POSTGRES: 'crm_to_postgres',
  BACKUP: 'backup',
  RESTORE: 'restore',
  FETCH_INVENTORY: 'fetch_inventory',
  FETCH_VOUCHERS: 'fetch_vouchers',
  FETCH_LEDGERS: 'fetch_ledgers',
  FULL_SYNC: 'full_sync'
};

// Job statuses
const JOB_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

/**
 * Enqueue a new job
 * @param {string} taskType - Type of task
 * @param {Object} payload - Job payload
 * @param {Object} options - { priority, maxAttempts, scheduledAt, createdBy }
 * @returns {Promise<Object>} Created job
 */
async function enqueue(taskType, payload = {}, options = {}) {
  const {
    priority = 0,
    maxAttempts = 3,
    scheduledAt = new Date(),
    createdBy = 'system'
  } = options;

  const sql = `
    INSERT INTO queue_jobs (
      task_type, payload, priority, max_attempts, scheduled_at, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;

  const result = await query(sql, [
    taskType,
    JSON.stringify(payload),
    priority,
    maxAttempts,
    scheduledAt,
    createdBy
  ]);

  await logJobEvent(result.rows[0].id, 'info', 'Job created', { taskType, payload });
  
  return result.rows[0];
}

/**
 * Enqueue a Tally fetch operation
 */
async function enqueueFetch(fetchType = 'all', createdBy = 'system') {
  const taskType = fetchType === 'inventory' ? TASK_TYPES.FETCH_INVENTORY
    : fetchType === 'vouchers' ? TASK_TYPES.FETCH_VOUCHERS
    : fetchType === 'ledgers' ? TASK_TYPES.FETCH_LEDGERS
    : TASK_TYPES.TALLY_SYNC;

  return enqueue(taskType, { fetchType }, { createdBy, priority: 10 });
}

/**
 * Enqueue a CRM to PostgreSQL sync operation
 */
async function enqueueSync(syncOptions = {}, createdBy = 'system') {
  return enqueue(TASK_TYPES.CRM_TO_POSTGRES, syncOptions, { createdBy, priority: 5 });
}

/**
 * Enqueue a backup operation
 */
async function enqueueBackup(backupOptions = {}, createdBy = 'system') {
  const { backupType = 'full', description = 'Manual backup' } = backupOptions;
  return enqueue(TASK_TYPES.BACKUP, { backupType, description }, { createdBy, priority: 3 });
}

/**
 * Enqueue a restore operation
 */
async function enqueueRestore(snapshotId, createdBy = 'system') {
  return enqueue(TASK_TYPES.RESTORE, { snapshotId }, { createdBy, priority: 1 });
}

/**
 * Get next job to process (oldest pending job that's ready)
 * Atomically marks job as processing
 * @returns {Promise<Object|null>} Job or null if none available
 */
async function dequeue() {
  const sql = `
    UPDATE queue_jobs
    SET status = $1, started_at = NOW(), attempts = attempts + 1
    WHERE id = (
      SELECT id FROM queue_jobs
      WHERE status = $2
      AND scheduled_at <= NOW()
      ORDER BY priority DESC, scheduled_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;

  const result = await query(sql, [JOB_STATUS.PROCESSING, JOB_STATUS.PENDING]);
  
  if (result.rows.length > 0) {
    await logJobEvent(result.rows[0].id, 'info', 'Job started processing');
  }
  
  return result.rows[0] || null;
}

/**
 * Mark a job as completed
 * @param {string} jobId - Job ID
 * @param {Object} result - Job result
 */
async function completeJob(jobId, result = {}) {
  const sql = `
    UPDATE queue_jobs
    SET status = $1, completed_at = NOW(), result = $2
    WHERE id = $3
    RETURNING *
  `;

  const res = await query(sql, [JOB_STATUS.COMPLETED, JSON.stringify(result), jobId]);
  await logJobEvent(jobId, 'info', 'Job completed successfully', result);
  
  return res.rows[0];
}

/**
 * Mark a job as failed
 * @param {string} jobId - Job ID
 * @param {string} errorMessage - Error message
 * @param {boolean} retry - Whether to retry (requeue)
 */
async function failJob(jobId, errorMessage, retry = true) {
  // Get current job to check attempts
  const jobResult = await query('SELECT * FROM queue_jobs WHERE id = $1', [jobId]);
  const job = jobResult.rows[0];

  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  // Check if should retry
  if (retry && job.attempts < job.max_attempts) {
    // Requeue with exponential backoff
    const backoffMinutes = Math.pow(2, job.attempts);
    const nextSchedule = new Date(Date.now() + backoffMinutes * 60 * 1000);

    const sql = `
      UPDATE queue_jobs
      SET status = $1, scheduled_at = $2, error_message = $3
      WHERE id = $4
      RETURNING *
    `;

    await query(sql, [JOB_STATUS.PENDING, nextSchedule, errorMessage, jobId]);
    await logJobEvent(jobId, 'warn', `Job failed, retrying in ${backoffMinutes} minutes`, { errorMessage });
    
    return { retried: true, nextAttempt: nextSchedule };
  }

  // Mark as failed permanently
  const sql = `
    UPDATE queue_jobs
    SET status = $1, completed_at = NOW(), error_message = $2
    WHERE id = $3
    RETURNING *
  `;

  await query(sql, [JOB_STATUS.FAILED, errorMessage, jobId]);
  await logJobEvent(jobId, 'error', 'Job failed permanently', { errorMessage });
  
  return { retried: false };
}

/**
 * Cancel a job
 * @param {string} jobId - Job ID
 */
async function cancelJob(jobId) {
  const sql = `
    UPDATE queue_jobs
    SET status = $1, completed_at = NOW()
    WHERE id = $2 AND status IN ($3, $4)
    RETURNING *
  `;

  const result = await query(sql, [
    JOB_STATUS.CANCELLED,
    jobId,
    JOB_STATUS.PENDING,
    JOB_STATUS.PROCESSING
  ]);

  if (result.rows.length > 0) {
    await logJobEvent(jobId, 'info', 'Job cancelled');
  }

  return result.rows[0];
}

/**
 * Get job by ID
 * @param {string} jobId - Job ID
 */
async function getJob(jobId) {
  const sql = 'SELECT * FROM queue_jobs WHERE id = $1';
  const result = await query(sql, [jobId]);
  return result.rows[0];
}

/**
 * Get all jobs with optional filtering
 * @param {Object} filters - { status, taskType, limit, offset }
 */
async function getJobs(filters = {}) {
  const { status, taskType, limit = 50, offset = 0 } = filters;
  
  let sql = 'SELECT * FROM queue_jobs WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (status) {
    sql += ` AND status = $${paramIndex++}`;
    params.push(status);
  }

  if (taskType) {
    sql += ` AND task_type = $${paramIndex++}`;
    params.push(taskType);
  }

  sql += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  params.push(limit, offset);

  const result = await query(sql, params);
  return result.rows;
}

/**
 * Get queue statistics
 */
async function getQueueStats() {
  const sql = `
    SELECT 
      status,
      COUNT(*) as count,
      AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds
    FROM queue_jobs
    GROUP BY status
  `;

  const result = await query(sql);
  
  const stats = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    total: 0
  };

  result.rows.forEach(row => {
    stats[row.status] = parseInt(row.count, 10);
    stats.total += parseInt(row.count, 10);
  });

  return stats;
}

/**
 * Flush the queue (cancel all pending jobs)
 * ROOT only operation
 */
async function flushQueue() {
  const sql = `
    UPDATE queue_jobs
    SET status = $1, completed_at = NOW()
    WHERE status = $2
    RETURNING id
  `;

  const result = await query(sql, [JOB_STATUS.CANCELLED, JOB_STATUS.PENDING]);
  
  return { flushedCount: result.rowCount };
}

/**
 * Cleanup old completed jobs
 * @param {number} retentionDays - Days to keep completed jobs
 */
async function cleanupOldJobs(retentionDays = 30) {
  const sql = `SELECT cleanup_old_queue_data($1)`;
  const result = await query(sql, [retentionDays]);
  return { deletedCount: result.rows[0].cleanup_old_queue_data };
}

/**
 * Log a job event
 * @param {string} jobId - Job ID
 * @param {string} level - Log level (info, warn, error)
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata
 */
async function logJobEvent(jobId, level, message, metadata = {}) {
  const sql = `
    INSERT INTO queue_job_logs (job_id, level, message, metadata)
    VALUES ($1, $2, $3, $4)
  `;

  try {
    await query(sql, [jobId, level, message, JSON.stringify(metadata)]);
  } catch (err) {
    console.error('Failed to log job event:', err.message);
  }
}

/**
 * Get logs for a job
 * @param {string} jobId - Job ID
 */
async function getJobLogs(jobId) {
  const sql = `
    SELECT * FROM queue_job_logs
    WHERE job_id = $1
    ORDER BY created_at ASC
  `;

  const result = await query(sql, [jobId]);
  return result.rows;
}

module.exports = {
  // Constants
  TASK_TYPES,
  JOB_STATUS,
  
  // Core queue operations
  enqueue,
  dequeue,
  completeJob,
  failJob,
  cancelJob,
  
  // Convenience enqueue methods
  enqueueFetch,
  enqueueSync,
  enqueueBackup,
  enqueueRestore,
  
  // Query operations
  getJob,
  getJobs,
  getQueueStats,
  getJobLogs,
  
  // Management operations
  flushQueue,
  cleanupOldJobs,
  logJobEvent
};

/**
 * Auto Backup Scheduler
 * Handles scheduled automatic backups based on configuration
 */

const { query } = require('../sql/connection');
const { enqueueBackup } = require('../queue/queue_manager');

// Scheduler state
let schedulerInterval = null;
let isRunning = false;

// Default schedule configuration
const DEFAULT_SCHEDULE = {
  enabled: true,
  intervalHours: 24,       // Backup every 24 hours
  retentionDays: 30,       // Keep backups for 30 days
  backupType: 'full',
  lastRunAt: null,
  nextRunAt: null
};

let currentConfig = { ...DEFAULT_SCHEDULE };

/**
 * Load schedule configuration from database
 */
async function loadScheduleConfig() {
  try {
    const result = await query(`
      SELECT * FROM backup_schedule 
      WHERE is_active = true 
      ORDER BY created_at DESC 
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      const schedule = result.rows[0];
      currentConfig = {
        enabled: schedule.is_active,
        intervalHours: parseCronToHours(schedule.schedule_cron),
        backupType: schedule.backup_type,
        retentionDays: 30,
        lastRunAt: schedule.last_run_at,
        nextRunAt: schedule.next_run_at,
        scheduleId: schedule.id
      };
    }
  } catch (err) {
    console.warn('[AutoBackup] Could not load config, using defaults:', err.message);
  }

  return currentConfig;
}

/**
 * Save schedule configuration to database
 */
async function saveScheduleConfig(config) {
  const cronExpression = hoursToCron(config.intervalHours || 24);
  
  if (config.scheduleId) {
    // Update existing
    await query(`
      UPDATE backup_schedule 
      SET schedule_cron = $1, 
          backup_type = $2, 
          is_active = $3,
          next_run_at = $4,
          updated_at = NOW()
      WHERE id = $5
    `, [
      cronExpression,
      config.backupType || 'full',
      config.enabled !== false,
      config.nextRunAt,
      config.scheduleId
    ]);
  } else {
    // Create new
    const result = await query(`
      INSERT INTO backup_schedule (name, schedule_cron, backup_type, is_active, next_run_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [
      'Auto Backup Schedule',
      cronExpression,
      config.backupType || 'full',
      config.enabled !== false,
      config.nextRunAt || new Date(Date.now() + (config.intervalHours || 24) * 60 * 60 * 1000)
    ]);
    config.scheduleId = result.rows[0].id;
  }

  currentConfig = { ...currentConfig, ...config };
  return currentConfig;
}

/**
 * Check if backup is due and enqueue if needed
 */
async function checkAndRunScheduledBackup() {
  if (!currentConfig.enabled) {
    return { ran: false, reason: 'Scheduler disabled' };
  }

  const now = new Date();
  
  // Check if next run time has passed
  if (currentConfig.nextRunAt && new Date(currentConfig.nextRunAt) > now) {
    return { ran: false, reason: 'Not yet time for backup' };
  }

  console.log('[AutoBackup] Scheduled backup time reached, enqueueing backup');

  try {
    // Enqueue backup job
    const job = await enqueueBackup({
      backupType: currentConfig.backupType || 'full',
      description: `Scheduled auto-backup at ${now.toISOString()}`
    }, 'scheduler');

    // Update last/next run times
    const nextRun = new Date(now.getTime() + (currentConfig.intervalHours || 24) * 60 * 60 * 1000);
    
    if (currentConfig.scheduleId) {
      await query(`
        UPDATE backup_schedule 
        SET last_run_at = $1, next_run_at = $2
        WHERE id = $3
      `, [now, nextRun, currentConfig.scheduleId]);
    }

    currentConfig.lastRunAt = now;
    currentConfig.nextRunAt = nextRun;

    return { ran: true, jobId: job.id, nextRunAt: nextRun };

  } catch (err) {
    console.error('[AutoBackup] Failed to enqueue backup:', err.message);
    return { ran: false, error: err.message };
  }
}

/**
 * Start the auto backup scheduler
 * @param {Object} options - { checkIntervalMinutes }
 */
function start(options = {}) {
  if (isRunning) {
    console.log('[AutoBackup] Scheduler already running');
    return;
  }

  const checkInterval = (options.checkIntervalMinutes || 5) * 60 * 1000;

  console.log('[AutoBackup] Starting auto backup scheduler');
  isRunning = true;

  // Load config
  loadScheduleConfig().then(() => {
    console.log(`[AutoBackup] Config loaded: ${currentConfig.enabled ? 'enabled' : 'disabled'}, interval: ${currentConfig.intervalHours}h`);
  });

  // Start checking interval
  schedulerInterval = setInterval(async () => {
    if (isRunning) {
      await checkAndRunScheduledBackup();
    }
  }, checkInterval);

  // Run initial check
  setTimeout(() => checkAndRunScheduledBackup(), 5000);

  console.log(`[AutoBackup] Scheduler started (checking every ${options.checkIntervalMinutes || 5} minutes)`);
}

/**
 * Stop the scheduler
 */
function stop() {
  if (!isRunning) {
    return;
  }

  console.log('[AutoBackup] Stopping scheduler');
  isRunning = false;

  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }

  console.log('[AutoBackup] Scheduler stopped');
}

/**
 * Update schedule configuration
 * @param {Object} config - { enabled, intervalHours, backupType }
 */
async function updateSchedule(config) {
  const newConfig = { ...currentConfig, ...config };
  
  // Calculate next run time if enabling
  if (config.enabled && !currentConfig.enabled) {
    newConfig.nextRunAt = new Date(Date.now() + (newConfig.intervalHours || 24) * 60 * 60 * 1000);
  }

  await saveScheduleConfig(newConfig);
  
  console.log(`[AutoBackup] Schedule updated: ${newConfig.enabled ? 'enabled' : 'disabled'}, interval: ${newConfig.intervalHours}h`);
  
  return currentConfig;
}

/**
 * Get current schedule status
 */
function getStatus() {
  return {
    isRunning,
    config: currentConfig
  };
}

/**
 * Trigger immediate backup (bypasses schedule)
 */
async function triggerNow() {
  console.log('[AutoBackup] Manual trigger requested');
  
  const job = await enqueueBackup({
    backupType: currentConfig.backupType || 'full',
    description: 'Manually triggered backup'
  }, 'manual');

  return { triggered: true, jobId: job.id };
}

/**
 * Helper: Convert hours to simple cron expression
 */
function hoursToCron(hours) {
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `0 0 */${days} * *`;
  }
  return `0 */${hours} * * *`;
}

/**
 * Helper: Parse simple cron to hours
 */
function parseCronToHours(cron) {
  if (!cron) return 24;
  
  const parts = cron.split(' ');
  if (parts.length < 5) return 24;
  
  // Check hourly pattern
  const hourPart = parts[1];
  if (hourPart.startsWith('*/')) {
    return parseInt(hourPart.slice(2)) || 24;
  }
  
  // Check daily pattern
  const dayPart = parts[2];
  if (dayPart.startsWith('*/')) {
    return (parseInt(dayPart.slice(2)) || 1) * 24;
  }
  
  return 24;
}

module.exports = {
  start,
  stop,
  updateSchedule,
  getStatus,
  triggerNow,
  checkAndRunScheduledBackup,
  loadScheduleConfig
};

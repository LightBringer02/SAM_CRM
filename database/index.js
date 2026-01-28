/**
 * Database Module - Main Entry Point
 * Exports all database functionality for easy importing
 */

// SQL utilities
const connection = require('./sql/connection');
const sqlUtils = require('./sql/sql_utils');

// Queue system
const queueManager = require('./queue/queue_manager');
const worker = require('./queue/worker');

// Backup system
const backupManager = require('./backup/backup_manager');
const autoBackupScheduler = require('./backup/auto_backup_scheduler');
const restoreManager = require('./backup/restore_manager');

// Fetch service
const fetchService = require('./fetch_service');

// Migrations
const migrations = require('./migrations/migration_runner');

/**
 * Initialize the database module
 * Sets up connection, runs migrations, starts worker
 */
async function initialize(options = {}) {
  const {
    runMigrations = true,
    startWorker = true,
    startBackupScheduler = false
  } = options;

  console.log('[Database] Initializing...');

  try {
    // Test database connection
    const connResult = await connection.testConnection();
    if (!connResult.connected) {
      throw new Error(`Database connection failed: ${connResult.error}`);
    }
    console.log('[Database] Connection established');

    // Run migrations if requested
    if (runMigrations) {
      await migrations.runInitialSetup();
      await migrations.runAllMigrations();
    }

    // Start queue worker if requested
    if (startWorker) {
      worker.start();
    }

    // Start backup scheduler if requested
    if (startBackupScheduler) {
      autoBackupScheduler.start();
    }

    console.log('[Database] Initialization complete');
    return { success: true };

  } catch (err) {
    console.error('[Database] Initialization failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Shutdown the database module
 */
async function shutdown() {
  console.log('[Database] Shutting down...');
  
  await worker.stop();
  autoBackupScheduler.stop();
  await connection.closePool();
  
  console.log('[Database] Shutdown complete');
}

/**
 * Get overall system status
 */
async function getStatus() {
  const connStatus = await connection.testConnection();
  const workerStatus = worker.getStatus();
  const backupStatus = autoBackupScheduler.getStatus();
  const queueStats = await queueManager.getQueueStats();
  
  return {
    database: connStatus,
    worker: workerStatus,
    backup: backupStatus,
    queue: queueStats
  };
}

// Queue dispatcher utilities for easy task enqueueing
const queueDispatcher = {
  enqueueFetch: queueManager.enqueueFetch,
  enqueueSync: queueManager.enqueueSync,
  enqueueBackup: queueManager.enqueueBackup,
  enqueueRestore: queueManager.enqueueRestore
};

module.exports = {
  // Initialization
  initialize,
  shutdown,
  getStatus,

  // SQL layer
  connection,
  sql: sqlUtils,

  // Queue system
  queue: queueManager,
  worker,
  queueDispatcher,

  // Backup system
  backup: backupManager,
  backupScheduler: autoBackupScheduler,
  restore: restoreManager,

  // Fetch service
  fetch: fetchService,

  // Migrations
  migrations,

  // Re-export commonly used functions
  testConnection: connection.testConnection,
  query: connection.query,
  transaction: connection.transaction,
  
  // Task types for reference
  TASK_TYPES: queueManager.TASK_TYPES,
  JOB_STATUS: queueManager.JOB_STATUS
};

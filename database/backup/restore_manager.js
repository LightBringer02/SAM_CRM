/**
 * Restore Manager
 * Handles backup restoration with validation and rollback support
 */

const { query, transaction } = require('../sql/connection');
const backupTask = require('../queue/tasks/backup_task');
const { enqueueRestore } = require('../queue/queue_manager');

/**
 * Validate a backup snapshot before restore
 * @param {string} snapshotId - Snapshot to validate
 */
async function validateSnapshot(snapshotId) {
  const snapshot = await backupTask.getSnapshotDetails(snapshotId);
  
  if (!snapshot) {
    return { valid: false, error: 'Snapshot not found' };
  }

  if (snapshot.status !== 'completed') {
    return { valid: false, error: `Snapshot status is ${snapshot.status}, expected completed` };
  }

  // Check backup data exists
  const dataResult = await query(
    'SELECT COUNT(*) as count FROM backup_data WHERE snapshot_id = $1',
    [snapshotId]
  );

  if (parseInt(dataResult.rows[0].count) === 0) {
    return { valid: false, error: 'No backup data found for snapshot' };
  }

  return {
    valid: true,
    snapshot,
    tablesCount: snapshot.tables?.length || 0,
    createdAt: snapshot.created_at
  };
}

/**
 * Preview restore operation
 * @param {string} snapshotId - Snapshot to preview
 */
async function previewRestore(snapshotId) {
  const validation = await validateSnapshot(snapshotId);
  
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const snapshot = validation.snapshot;
  
  // Get current row counts for comparison
  const currentCounts = {};
  for (const table of snapshot.tables || []) {
    const result = await query(`SELECT COUNT(*) as count FROM ${table.table_name}`);
    currentCounts[table.table_name] = parseInt(result.rows[0].count);
  }

  return {
    snapshotId,
    snapshotName: snapshot.name,
    createdAt: snapshot.created_at,
    tables: snapshot.tables?.map(t => ({
      name: t.table_name,
      backupRows: t.row_count,
      currentRows: currentCounts[t.table_name] || 0,
      willReplace: true
    })) || [],
    warnings: [
      'This operation will replace all current data with backup data',
      'Current data will be permanently lost unless backed up first'
    ]
  };
}

/**
 * Execute restore with safety checks
 * @param {string} snapshotId - Snapshot to restore from
 * @param {Object} options - { createBackupFirst, force }
 * @param {string} restoredBy - User performing restore
 */
async function executeRestore(snapshotId, options = {}, restoredBy = 'system') {
  const { createBackupFirst = true, force = false } = options;

  console.log(`[RestoreManager] Starting restore from ${snapshotId}`);

  // Validate snapshot
  const validation = await validateSnapshot(snapshotId);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Create pre-restore backup if requested
  let preRestoreBackupId = null;
  if (createBackupFirst) {
    console.log('[RestoreManager] Creating pre-restore backup');
    const backup = await backupTask.executeBackup({
      backupType: 'full',
      description: `Pre-restore backup before restoring ${snapshotId}`,
      createdBy: restoredBy
    });
    preRestoreBackupId = backup.snapshotId;
    console.log(`[RestoreManager] Pre-restore backup created: ${preRestoreBackupId}`);
  }

  try {
    // Execute restore
    const result = await backupTask.executeRestore({ snapshotId });

    // Record restore operation
    await query(`
      INSERT INTO sync_history (sync_type, source, destination, status, items_synced, metadata, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      'restore',
      `backup:${snapshotId}`,
      'database',
      'completed',
      result.totalRows,
      JSON.stringify({ 
        snapshotId, 
        preRestoreBackupId,
        tables: result.tables 
      }),
      restoredBy
    ]);

    return {
      success: true,
      ...result,
      preRestoreBackupId
    };

  } catch (err) {
    console.error('[RestoreManager] Restore failed:', err.message);

    // Record failed restore
    await query(`
      INSERT INTO sync_history (sync_type, source, destination, status, error_message, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      'restore',
      `backup:${snapshotId}`,
      'database',
      'failed',
      err.message,
      restoredBy
    ]);

    // If we have a pre-restore backup, mention it in error
    if (preRestoreBackupId) {
      err.message += ` (Pre-restore backup available: ${preRestoreBackupId})`;
    }

    throw err;
  }
}

/**
 * Queue a restore operation
 * @param {string} snapshotId - Snapshot to restore from
 * @param {string} createdBy - User queuing restore
 */
async function queueRestore(snapshotId, createdBy = 'system') {
  const validation = await validateSnapshot(snapshotId);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const job = await enqueueRestore(snapshotId, createdBy);
  
  return {
    queued: true,
    jobId: job.id,
    snapshotId,
    message: 'Restore job queued successfully'
  };
}

/**
 * Rollback to pre-restore backup
 * @param {string} preRestoreBackupId - Pre-restore backup ID
 * @param {string} restoredBy - User performing rollback
 */
async function rollbackRestore(preRestoreBackupId, restoredBy = 'system') {
  console.log(`[RestoreManager] Rolling back to pre-restore backup: ${preRestoreBackupId}`);
  
  return await executeRestore(preRestoreBackupId, { 
    createBackupFirst: false,
    force: true 
  }, restoredBy);
}

/**
 * Get restore history
 * @param {number} limit - Number of records
 */
async function getRestoreHistory(limit = 20) {
  const result = await query(`
    SELECT * FROM sync_history 
    WHERE sync_type = 'restore'
    ORDER BY started_at DESC
    LIMIT $1
  `, [limit]);

  return result.rows;
}

/**
 * Compare current state with backup
 * @param {string} snapshotId - Snapshot to compare
 */
async function compareWithBackup(snapshotId) {
  const snapshot = await backupTask.getSnapshotDetails(snapshotId);
  
  if (!snapshot) {
    throw new Error('Snapshot not found');
  }

  const comparison = {
    snapshotId,
    snapshotName: snapshot.name,
    snapshotDate: snapshot.created_at,
    tables: []
  };

  for (const table of snapshot.tables || []) {
    const currentResult = await query(
      `SELECT COUNT(*) as count FROM ${table.table_name}`
    );
    
    comparison.tables.push({
      name: table.table_name,
      backupRows: table.row_count,
      currentRows: parseInt(currentResult.rows[0].count),
      difference: parseInt(currentResult.rows[0].count) - table.row_count
    });
  }

  return comparison;
}

module.exports = {
  validateSnapshot,
  previewRestore,
  executeRestore,
  queueRestore,
  rollbackRestore,
  getRestoreHistory,
  compareWithBackup
};

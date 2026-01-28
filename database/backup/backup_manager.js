/**
 * Backup Manager
 * High-level backup management API
 * Coordinates backup operations through the queue system
 */

const { enqueueBackup, enqueueRestore, getJobs, JOB_STATUS } = require('../queue/queue_manager');
const backupTask = require('../queue/tasks/backup_task');

/**
 * Create a new backup
 * @param {Object} options - { backupType, description, immediate }
 * @param {string} createdBy - User who created the backup
 */
async function createBackup(options = {}, createdBy = 'system') {
  const { 
    backupType = 'full', 
    description = 'Manual backup',
    immediate = false 
  } = options;

  console.log(`[BackupManager] Creating ${backupType} backup (immediate: ${immediate})`);

  if (immediate) {
    // Execute backup immediately without queue
    return await backupTask.executeBackup({
      backupType,
      description,
      createdBy
    });
  }

  // Enqueue backup job
  const job = await enqueueBackup({
    backupType,
    description
  }, createdBy);

  return {
    queued: true,
    jobId: job.id,
    message: 'Backup job queued successfully'
  };
}

/**
 * Restore from a backup
 * @param {string} snapshotId - Snapshot to restore from
 * @param {Object} options - { immediate }
 * @param {string} createdBy - User initiating restore
 */
async function restoreBackup(snapshotId, options = {}, createdBy = 'system') {
  const { immediate = false } = options;

  console.log(`[BackupManager] Restoring from snapshot: ${snapshotId} (immediate: ${immediate})`);

  // Verify snapshot exists
  const snapshot = await backupTask.getSnapshotDetails(snapshotId);
  if (!snapshot) {
    throw new Error(`Snapshot ${snapshotId} not found`);
  }

  if (snapshot.status !== 'completed') {
    throw new Error(`Cannot restore from snapshot with status: ${snapshot.status}`);
  }

  if (immediate) {
    // Execute restore immediately
    return await backupTask.executeRestore({ snapshotId });
  }

  // Enqueue restore job
  const job = await enqueueRestore(snapshotId, createdBy);

  return {
    queued: true,
    jobId: job.id,
    message: 'Restore job queued successfully'
  };
}

/**
 * List all backups
 * @param {Object} filters - { limit, status }
 */
async function listBackups(filters = {}) {
  return await backupTask.listSnapshots(filters);
}

/**
 * Get backup details
 * @param {string} snapshotId - Snapshot ID
 */
async function getBackupDetails(snapshotId) {
  return await backupTask.getSnapshotDetails(snapshotId);
}

/**
 * Delete a backup
 * @param {string} snapshotId - Snapshot ID
 */
async function deleteBackup(snapshotId) {
  return await backupTask.deleteSnapshot(snapshotId);
}

/**
 * Get backup job status
 * @param {string} jobId - Job ID
 */
async function getBackupJobStatus(jobId) {
  const jobs = await getJobs({ taskType: 'backup' });
  return jobs.find(j => j.id === jobId);
}

/**
 * Get recent backup jobs
 * @param {number} limit - Number of jobs to return
 */
async function getRecentBackupJobs(limit = 10) {
  return await getJobs({ taskType: 'backup', limit });
}

/**
 * Get backup statistics
 */
async function getBackupStats() {
  const backups = await backupTask.listSnapshots({ limit: 100 });
  
  // Parse size_bytes safely, ensuring we get valid numbers
  const totalSizeBytes = backups.reduce((sum, b) => {
    const size = parseInt(b.size_bytes, 10);
    // Only add valid positive numbers, ignore anything unreasonably large (> 10TB)
    if (!isNaN(size) && size > 0 && size < 10 * 1024 * 1024 * 1024 * 1024) {
      return sum + size;
    }
    return sum;
  }, 0);

  const stats = {
    total: backups.length,
    completed: backups.filter(b => b.status === 'completed').length,
    failed: backups.filter(b => b.status === 'failed').length,
    pending: backups.filter(b => b.status === 'pending' || b.status === 'in_progress').length,
    totalSizeBytes: totalSizeBytes,
    lastBackup: backups[0] || null
  };

  return stats;
}

/**
 * Cleanup old backups
 * @param {number} retentionDays - Days to keep backups
 */
async function cleanupBackups(retentionDays = 30) {
  return await backupTask.cleanupOldBackups(retentionDays);
}

module.exports = {
  createBackup,
  restoreBackup,
  listBackups,
  getBackupDetails,
  deleteBackup,
  getBackupJobStatus,
  getRecentBackupJobs,
  getBackupStats,
  cleanupBackups
};

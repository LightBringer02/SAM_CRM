/**
 * Backup Routes
 * REST API for backup management - ROOT and ADMIN access
 * Note: ROOT users have full access, ADMIN users can manage backups
 */

const express = require('express');
const router = express.Router();

// Import modules
const { extractUser, requireAdmin } = require('../../backend/middleware/authMiddleware');
const backupManager = require('../backup/backup_manager');
const restoreManager = require('../backup/restore_manager');
const autoBackupScheduler = require('../backup/auto_backup_scheduler');

// Apply auth middleware - ROOT and ADMIN can access backup management
router.use(extractUser);
router.use(requireAdmin);

/**
 * GET /api/backup/status
 * Get backup system status
 */
router.get('/status', async (req, res) => {
  try {
    const stats = await backupManager.getBackupStats();
    const schedulerStatus = autoBackupScheduler.getStatus();
    
    res.json({
      success: true,
      data: {
        stats,
        scheduler: schedulerStatus
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/backup/list
 * List all backups
 */
router.get('/list', async (req, res) => {
  try {
    const { limit = 20, status } = req.query;
    const backups = await backupManager.listBackups({ 
      limit: parseInt(limit), 
      status 
    });
    
    res.json({
      success: true,
      data: backups,
      count: backups.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/backup/:id
 * Get backup details
 */
router.get('/:id', async (req, res) => {
  try {
    const backup = await backupManager.getBackupDetails(req.params.id);
    
    if (!backup) {
      return res.status(404).json({ success: false, error: 'Backup not found' });
    }
    
    res.json({
      success: true,
      data: backup
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/backup/create
 * Create a new backup
 */
router.post('/create', async (req, res) => {
  try {
    const { backupType = 'full', description, immediate = true } = req.body;
    
    const result = await backupManager.createBackup(
      { backupType, description, immediate },
      req.user?.username || 'root'
    );
    
    res.json({
      success: true,
      message: immediate ? 'Backup created' : 'Backup job queued',
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/backup/:id/restore
 * Restore from a backup
 */
router.post('/:id/restore', async (req, res) => {
  try {
    const { createBackupFirst = true, immediate = true } = req.body;
    
    if (immediate) {
      const result = await restoreManager.executeRestore(
        req.params.id,
        { createBackupFirst },
        req.user?.username || 'root'
      );
      
      res.json({
        success: true,
        message: 'Restore completed',
        data: result
      });
    } else {
      const result = await restoreManager.queueRestore(
        req.params.id,
        req.user?.username || 'root'
      );
      
      res.json({
        success: true,
        message: 'Restore job queued',
        data: result
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/backup/:id/preview
 * Preview what restore would do
 */
router.post('/:id/preview', async (req, res) => {
  try {
    const preview = await restoreManager.previewRestore(req.params.id);
    
    res.json({
      success: true,
      data: preview
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/backup/:id
 * Delete a backup
 */
router.delete('/:id', async (req, res) => {
  try {
    await backupManager.deleteBackup(req.params.id);
    
    res.json({
      success: true,
      message: 'Backup deleted'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/backup/schedule/status
 * Get auto-backup schedule status
 */
router.get('/schedule/status', (req, res) => {
  try {
    const status = autoBackupScheduler.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/backup/schedule/update
 * Update auto-backup schedule
 */
router.post('/schedule/update', async (req, res) => {
  try {
    const { enabled, intervalHours, backupType } = req.body;
    
    const config = await autoBackupScheduler.updateSchedule({
      enabled,
      intervalHours,
      backupType
    });
    
    res.json({
      success: true,
      message: 'Schedule updated',
      data: config
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/backup/schedule/start
 * Start auto-backup scheduler
 */
router.post('/schedule/start', (req, res) => {
  try {
    autoBackupScheduler.start();
    
    res.json({
      success: true,
      message: 'Auto-backup scheduler started',
      data: autoBackupScheduler.getStatus()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/backup/schedule/stop
 * Stop auto-backup scheduler
 */
router.post('/schedule/stop', (req, res) => {
  try {
    autoBackupScheduler.stop();
    
    res.json({
      success: true,
      message: 'Auto-backup scheduler stopped',
      data: autoBackupScheduler.getStatus()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/backup/:id/download
 * Download backup as JSON file
 */
router.get('/:id/download', async (req, res) => {
  try {
    const backup = await backupManager.getBackupDetails(req.params.id);
    
    if (!backup) {
      return res.status(404).json({ success: false, error: 'Backup not found' });
    }
    
    if (backup.status !== 'completed') {
      return res.status(400).json({ success: false, error: 'Cannot download incomplete backup' });
    }
    
    // Get backup data
    const backupTask = require('../queue/tasks/backup_task');
    const data = await backupTask.getSnapshotData(req.params.id);
    
    // Create download response
    const fileName = `backup_${backup.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    res.json({
      backup_info: {
        id: backup.id,
        name: backup.name,
        created_at: backup.created_at,
        backup_type: backup.backup_type,
        tables_included: backup.tables_included
      },
      data: data
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/backup/schedule/trigger
 * Trigger immediate backup from scheduler
 */
router.post('/schedule/trigger', async (req, res) => {
  try {
    const result = await autoBackupScheduler.triggerNow();
    
    res.json({
      success: true,
      message: 'Backup triggered',
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/backup/cleanup
 * Cleanup old backups
 */
router.post('/cleanup', async (req, res) => {
  try {
    const { retentionDays = 30 } = req.body;
    const result = await backupManager.cleanupBackups(retentionDays);
    
    res.json({
      success: true,
      message: `Cleaned up old backups`,
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/backup/history
 * Get restore history
 */
router.get('/restore/history', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const history = await restoreManager.getRestoreHistory(parseInt(limit));
    
    res.json({
      success: true,
      data: history
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

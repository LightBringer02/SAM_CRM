/**
 * System Configuration Routes
 * Provides endpoints for managing system configuration
 * ROOT-only access for modifications
 */

const express = require('express');
const router = express.Router();
const { getConfig, updateConfig, getLimits, resetConfig } = require('../config/systemConfig');
const { extractUser, requireRoot, requireAuth, sanitizeConfigForRole, isRoot } = require('../middleware/authMiddleware');

// Apply user extraction middleware to all routes
router.use(extractUser);

/**
 * GET /api/system-config
 * Get current system configuration
 * - ROOT: Full config
 * - ADMIN: Sanitized config (no sensitive data)
 * - Others: Minimal config (backend mode only)
 */
router.get('/', requireAuth, (req, res) => {
  try {
    const config = getConfig();
    const sanitized = sanitizeConfigForRole(config, req.user.role);
    res.json({ success: true, data: sanitized });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/system-config/full
 * Get full system configuration (ROOT only)
 */
router.get('/full', requireRoot, (req, res) => {
  try {
    const config = getConfig();
    res.json({ success: true, data: config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/system-config
 * Update system configuration (ROOT only)
 */
router.put('/', requireRoot, (req, res) => {
  try {
    const updates = req.body;
    const userId = req.user?.id || 'unknown';
    
    const newConfig = updateConfig(updates, userId);
    res.json({ success: true, data: newConfig, message: 'Configuration updated successfully' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/system-config/tally-url
 * Update Tally URL (ROOT only)
 */
router.put('/tally-url', requireRoot, (req, res) => {
  try {
    const { tallyUrl } = req.body;
    
    if (!tallyUrl || typeof tallyUrl !== 'string') {
      return res.status(400).json({ success: false, error: 'Valid tallyUrl is required' });
    }
    
    const userId = req.user?.id || 'unknown';
    const newConfig = updateConfig({ tallyUrl }, userId);
    
    res.json({ success: true, data: { tallyUrl: newConfig.tallyUrl }, message: 'Tally URL updated successfully' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/system-config/database
 * Update database settings (ROOT only)
 */
router.put('/database', requireRoot, (req, res) => {
  try {
    const { database } = req.body;
    
    if (!database || typeof database !== 'object') {
      return res.status(400).json({ success: false, error: 'Valid database object is required' });
    }
    
    const userId = req.user?.id || 'unknown';
    const currentConfig = getConfig();
    
    const newDatabase = {
      ...currentConfig.database,
      ...database
    };
    
    const newConfig = updateConfig({ database: newDatabase }, userId);
    
    res.json({ success: true, data: { database: newConfig.database }, message: 'Database settings updated successfully' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/system-config/limits
 * Update creation limits (ROOT only)
 */
router.put('/limits', requireRoot, (req, res) => {
  try {
    const { limits } = req.body;
    
    if (!limits || typeof limits !== 'object') {
      return res.status(400).json({ success: false, error: 'Valid limits object is required' });
    }
    
    const userId = req.user?.id || 'unknown';
    const currentConfig = getConfig();
    
    const newLimits = {
      ...currentConfig.limits,
      ...limits
    };
    
    const newConfig = updateConfig({ limits: newLimits }, userId);
    
    res.json({ success: true, data: { limits: newConfig.limits }, message: 'Limits updated successfully' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/system-config/backend-mode
 * Update backend mode (ROOT only)
 * Valid modes: 'LOCAL', 'LIVE', 'OFFLINE', 'DUMMY_DATA'
 */
router.put('/backend-mode', requireRoot, (req, res) => {
  try {
    const { backendMode, liveServerUrl } = req.body;
    
    if (!backendMode || !['LOCAL', 'LIVE', 'OFFLINE', 'DUMMY_DATA'].includes(backendMode)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Valid backendMode is required. Must be LOCAL, LIVE, OFFLINE, or DUMMY_DATA' 
      });
    }
    
    const userId = req.user?.id || 'unknown';
    const updates = { backendMode };
    
    if (liveServerUrl) {
      updates.liveServerUrl = liveServerUrl;
    }
    
    const newConfig = updateConfig(updates, userId);
    
    res.json({ 
      success: true, 
      data: { 
        backendMode: newConfig.backendMode,
        liveServerUrl: newConfig.liveServerUrl 
      }, 
      message: `Backend mode set to ${backendMode}` 
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/system-config/limits
 * Get current limits (accessible to admins and root)
 */
router.get('/limits', requireAuth, (req, res) => {
  try {
    const limits = getLimits();
    res.json({ success: true, data: limits });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/system-config/reset
 * Reset configuration to defaults (ROOT only)
 */
router.post('/reset', requireRoot, (req, res) => {
  try {
    const userId = req.user?.id || 'unknown';
    const config = resetConfig(userId);
    res.json({ success: true, data: config, message: 'Configuration reset to defaults' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/system-config/check-root
 * Check if current user is ROOT
 */
router.get('/check-root', extractUser, (req, res) => {
  const userIsRoot = isRoot(req.user);
  res.json({ 
    success: true, 
    isRoot: userIsRoot,
    role: req.user?.role || 'guest'
  });
});

/**
 * PUT /api/system-config/service-toggle
 * Enable or disable the service (ROOT only)
 * When disabled, all non-root requests get blocked
 */
router.put('/service-toggle', requireRoot, (req, res) => {
  try {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ 
        success: false, 
        error: 'enabled must be a boolean value' 
      });
    }
    
    const userId = req.user?.id || 'unknown';
    const newConfig = updateConfig({ serviceEnabled: enabled }, userId);
    
    res.json({ 
      success: true, 
      data: { serviceEnabled: newConfig.serviceEnabled }, 
      message: enabled ? 'Service enabled' : 'Service disabled - only ROOT can access'
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/system-config/service-status
 * Get current service status (public endpoint)
 */
router.get('/service-status', (req, res) => {
  try {
    const config = getConfig();
    res.json({ 
      success: true, 
      data: { 
        serviceEnabled: config.serviceEnabled !== false,
        backendMode: config.backendMode
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

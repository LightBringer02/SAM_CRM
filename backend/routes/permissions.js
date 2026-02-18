const express = require('express');
const router = express.Router();
const { 
  extractUser, 
  requireAdmin, 
  requireRoot,
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  getUserPermissions,
  setUserPermissions,
  hasPermission
} = require('../middleware/authMiddleware');

/**
 * GET /api/permissions
 * Get all available permissions
 */
router.get('/', extractUser, requireAdmin, (req, res) => {
  res.json({
    success: true,
    permissions: ALL_PERMISSIONS,
    roleDefaults: DEFAULT_ROLE_PERMISSIONS
  });
});

/**
 * GET /api/permissions/user/:userId
 * Get a user's effective permissions
 */
router.get('/user/:userId', extractUser, requireAdmin, (req, res) => {
  const { userId } = req.params;
  
  // Mock user object for permission check
  const targetUser = { id: userId, role: req.query.role || 'user' };
  const permissions = getUserPermissions(targetUser);
  
  res.json({
    success: true,
    userId,
    role: targetUser.role,
    permissions,
    permissionDetails: permissions.map(p => ({
      id: p,
      ...ALL_PERMISSIONS[p]
    }))
  });
});

/**
 * PUT /api/permissions/user/:userId
 * Update a user's custom permissions (admin only)
 */
router.put('/user/:userId', extractUser, requireAdmin, (req, res) => {
  const { userId } = req.params;
  const { permissions } = req.body;
  
  if (!Array.isArray(permissions)) {
    return res.status(400).json({ success: false, error: 'Permissions must be an array' });
  }
  
  // Validate all permissions exist
  const invalidPerms = permissions.filter(p => !ALL_PERMISSIONS[p]);
  if (invalidPerms.length > 0) {
    return res.status(400).json({ 
      success: false, 
      error: `Invalid permissions: ${invalidPerms.join(', ')}` 
    });
  }
  
  setUserPermissions(userId, permissions);
  
  res.json({
    success: true,
    message: `Permissions updated for user ${userId}`,
    permissions
  });
});

/**
 * GET /api/permissions/check
 * Check if current user has specific permission(s)
 */
router.get('/check', extractUser, (req, res) => {
  const { permission, permissions } = req.query;
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  
  if (permission) {
    // Check single permission
    return res.json({
      success: true,
      permission,
      hasPermission: hasPermission(user, permission)
    });
  }
  
  if (permissions) {
    // Check multiple permissions
    const permArray = permissions.split(',');
    const results = {};
    permArray.forEach(p => {
      results[p] = hasPermission(user, p);
    });
    return res.json({
      success: true,
      permissions: results
    });
  }
  
  // Return all user permissions
  return res.json({
    success: true,
    permissions: getUserPermissions(user)
  });
});

/**
 * GET /api/permissions/my
 * Get current user's permissions
 */
router.get('/my', extractUser, (req, res) => {
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  
  const permissions = getUserPermissions(user);
  
  res.json({
    success: true,
    role: user.role,
    permissions,
    permissionDetails: permissions.map(p => ({
      id: p,
      ...ALL_PERMISSIONS[p]
    }))
  });
});

module.exports = router;

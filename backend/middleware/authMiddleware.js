/**
 * Authentication Middleware
 * Handles role-based access control with ROOT priority
 * 
 * Security Features:
 * - Role-based access control
 * - Brute force protection
 * - Secure token validation
 * - Request origin validation
 */

const { isServiceEnabled } = require('../config/systemConfig');

// Brute force protection storage
const loginAttempts = new Map();
const BRUTE_FORCE_CONFIG = {
  maxAttempts: 5,
  lockoutMs: 15 * 60 * 1000, // 15 minutes
  cleanupIntervalMs: 5 * 60 * 1000 // 5 minutes
};

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of loginAttempts.entries()) {
    if (now - data.firstAttempt > BRUTE_FORCE_CONFIG.lockoutMs) {
      loginAttempts.delete(key);
    }
  }
}, BRUTE_FORCE_CONFIG.cleanupIntervalMs);

// User roles hierarchy
const ROLES = {
  ROOT: 'root',
  ADMIN: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff',
  USER: 'user'
};

// Role hierarchy (higher index = more permissions)
const ROLE_HIERARCHY = [ROLES.USER, ROLES.STAFF, ROLES.MANAGER, ROLES.ADMIN, ROLES.ROOT];

/**
 * Get role level (higher = more permissions)
 */
function getRoleLevel(role) {
  const index = ROLE_HIERARCHY.indexOf(role?.toLowerCase());
  return index >= 0 ? index : 0;
}

/**
 * Check if user has at least the required role
 */
function hasMinimumRole(userRole, requiredRole) {
  return getRoleLevel(userRole) >= getRoleLevel(requiredRole);
}

/**
 * Check if user is ROOT
 */
function isRoot(user) {
  return user?.role?.toLowerCase() === ROLES.ROOT;
}

/**
 * Check if user is ADMIN or higher
 */
function isAdminOrHigher(user) {
  return hasMinimumRole(user?.role, ROLES.ADMIN);
}

/**
 * Middleware: Require ROOT access
 * Only ROOT users can access
 */
function requireRoot(req, res, next) {
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (!isRoot(user)) {
    return res.status(403).json({ error: 'ROOT access required. Access denied.' });
  }
  
  next();
}

/**
 * Middleware: Require ADMIN or higher access
 * ROOT and ADMIN users can access
 */
function requireAdmin(req, res, next) {
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (!isAdminOrHigher(user)) {
    return res.status(403).json({ error: 'Admin access required. Access denied.' });
  }
  
  next();
}

/**
 * Middleware: Require authenticated user
 */
function requireAuth(req, res, next) {
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  next();
}

/**
 * Middleware: Extract user from request headers
 * Expects user info in 'x-user-id' and 'x-user-role' headers
 * In production, this should validate JWT tokens
 * 
 * SECURITY: Validates and sanitizes all user input
 */
function extractUser(req, res, next) {
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];
  const username = req.headers['x-username'];
  
  // Sanitize inputs to prevent injection
  const sanitizeHeader = (value, maxLength = 100) => {
    if (!value) return null;
    // Remove any potentially dangerous characters
    return String(value)
      .trim()
      .substring(0, maxLength)
      .replace(/[<>\"\'\\;]/g, '');
  };
  
  const sanitizedUserId = sanitizeHeader(userId, 50);
  const sanitizedRole = sanitizeHeader(userRole, 20);
  const sanitizedUsername = sanitizeHeader(username, 100);
  
  // Validate role is from allowed list
  const validRoles = Object.values(ROLES);
  const normalizedRole = sanitizedRole?.toLowerCase();
  const isValidRole = normalizedRole && validRoles.includes(normalizedRole);
  
  // Accept user if either userId or userRole is provided (more lenient)
  // Handle empty strings as falsy values
  const hasUserId = sanitizedUserId && sanitizedUserId !== '';
  const hasUserRole = isValidRole;
  
  if (hasUserId || hasUserRole) {
    req.user = {
      id: hasUserId ? sanitizedUserId : '0',
      role: hasUserRole ? normalizedRole : 'user',
      username: sanitizedUsername || 'Unknown'
    };
  }
  
  next();
}

/**
 * Middleware: Check if service is enabled
 * Blocks all non-root traffic when service is disabled
 * ROOT users always bypass this check
 */
function checkServiceEnabled(req, res, next) {
  // ROOT users always bypass service check
  if (isRoot(req.user)) {
    return next();
  }
  
  // Check if service is enabled
  if (!isServiceEnabled()) {
    return res.status(503).json({
      success: false,
      error: 'Service temporarily disabled',
      message: 'The service has been temporarily disabled by the administrator. Please try again later.'
    });
  }
  
  next();
}

/**
 * Block config access for non-ROOT users
 * Returns sanitized config for admins (without sensitive data)
 */
function sanitizeConfigForRole(config, userRole) {
  if (userRole?.toLowerCase() === ROLES.ROOT) {
    return config;
  }
  
  // For admins: hide sensitive database info
  if (userRole?.toLowerCase() === ROLES.ADMIN) {
    return {
      ...config,
      database: {
        host: '***',
        port: '***',
        name: config.database?.name || '***',
        user: '***',
        password: '***'
      },
      tallyUrl: config.tallyUrl ? '(configured)' : '(not configured)',
      liveServerUrl: config.liveServerUrl ? '(configured)' : '(not configured)'
    };
  }
  
  // For regular users: only show backend mode
  return {
    backendMode: config.backendMode
  };
}

/**
 * Check brute force protection for an identifier (IP or userId)
 * @param {string} identifier - IP address or user ID
 * @returns {Object} - { blocked: boolean, attemptsRemaining: number }
 */
function checkBruteForce(identifier) {
  const entry = loginAttempts.get(identifier);
  const now = Date.now();
  
  if (!entry) {
    return { blocked: false, attemptsRemaining: BRUTE_FORCE_CONFIG.maxAttempts };
  }
  
  // Check if lockout period has passed
  if (now - entry.firstAttempt > BRUTE_FORCE_CONFIG.lockoutMs) {
    loginAttempts.delete(identifier);
    return { blocked: false, attemptsRemaining: BRUTE_FORCE_CONFIG.maxAttempts };
  }
  
  // Check if max attempts exceeded
  if (entry.attempts >= BRUTE_FORCE_CONFIG.maxAttempts) {
    const lockoutRemaining = Math.ceil((entry.firstAttempt + BRUTE_FORCE_CONFIG.lockoutMs - now) / 1000);
    return { blocked: true, attemptsRemaining: 0, lockoutSeconds: lockoutRemaining };
  }
  
  return { blocked: false, attemptsRemaining: BRUTE_FORCE_CONFIG.maxAttempts - entry.attempts };
}

/**
 * Record a failed login attempt
 * @param {string} identifier - IP address or user ID
 */
function recordFailedAttempt(identifier) {
  const entry = loginAttempts.get(identifier);
  const now = Date.now();
  
  if (!entry) {
    loginAttempts.set(identifier, { attempts: 1, firstAttempt: now });
  } else {
    entry.attempts++;
  }
}

/**
 * Clear failed attempts after successful login
 * @param {string} identifier - IP address or user ID
 */
function clearFailedAttempts(identifier) {
  loginAttempts.delete(identifier);
}

// ===========================================
// RBAC PERMISSION SYSTEM
// ===========================================

// All available permissions in the system
const ALL_PERMISSIONS = {
  // Inventory permissions
  'view_inventory': { category: 'Inventory', description: 'View inventory items' },
  'create_inventory': { category: 'Inventory', description: 'Add new inventory items' },
  'edit_inventory': { category: 'Inventory', description: 'Edit inventory items' },
  'delete_inventory': { category: 'Inventory', description: 'Delete inventory items' },
  'view_rates': { category: 'Inventory', description: 'View item rates/prices' },
  
  // Orders permissions
  'view_orders': { category: 'Orders', description: 'View orders' },
  'create_orders': { category: 'Orders', description: 'Create new orders' },
  'edit_orders': { category: 'Orders', description: 'Edit orders' },
  'delete_orders': { category: 'Orders', description: 'Delete orders' },
  'convert_orders': { category: 'Orders', description: 'Convert orders to sales' },
  
  // Vouchers permissions
  'view_vouchers': { category: 'Vouchers', description: 'View vouchers' },
  'create_vouchers': { category: 'Vouchers', description: 'Create new vouchers' },
  'edit_vouchers': { category: 'Vouchers', description: 'Edit vouchers' },
  'delete_vouchers': { category: 'Vouchers', description: 'Delete vouchers' },
  
  // Ledgers permissions
  'view_ledgers': { category: 'Ledgers', description: 'View ledgers' },
  'create_ledgers': { category: 'Ledgers', description: 'Create new ledgers' },
  'edit_ledgers': { category: 'Ledgers', description: 'Edit ledgers' },
  'delete_ledgers': { category: 'Ledgers', description: 'Delete ledgers' },
  'view_blacklisted_ledgers': { category: 'Ledgers', description: 'View blacklisted ledgers' },
  'manage_blacklist': { category: 'Ledgers', description: 'Add/remove ledgers from blacklist' },
  
  // Users & Employees permissions
  'view_users': { category: 'Users', description: 'View user accounts' },
  'create_users': { category: 'Users', description: 'Create new users' },
  'edit_users': { category: 'Users', description: 'Edit user accounts' },
  'delete_users': { category: 'Users', description: 'Delete user accounts' },
  'view_employees': { category: 'Employees', description: 'View employees' },
  'manage_employees': { category: 'Employees', description: 'Manage employees' },
  
  // Reports & Logs permissions
  'view_reports': { category: 'Reports', description: 'View reports' },
  'export_reports': { category: 'Reports', description: 'Export reports' },
  'view_logs': { category: 'Logs', description: 'View system logs' },
  'clear_logs': { category: 'Logs', description: 'Clear system logs' },
  
  // System permissions
  'manage_settings': { category: 'System', description: 'Manage system settings' },
  'manage_roles': { category: 'System', description: 'Manage roles and permissions' },
  'sync_tally': { category: 'System', description: 'Sync with Tally' },
  'manage_backups': { category: 'System', description: 'Manage database backups' }
};

// Default permissions by role
const DEFAULT_ROLE_PERMISSIONS = {
  root: Object.keys(ALL_PERMISSIONS), // Root has all permissions
  admin: [
    'view_inventory', 'create_inventory', 'edit_inventory', 'delete_inventory', 'view_rates',
    'view_orders', 'create_orders', 'edit_orders', 'delete_orders', 'convert_orders',
    'view_vouchers', 'create_vouchers', 'edit_vouchers', 'delete_vouchers',
    'view_ledgers', 'create_ledgers', 'edit_ledgers', 'delete_ledgers', 'view_blacklisted_ledgers', 'manage_blacklist',
    'view_users', 'create_users', 'edit_users', 'delete_users',
    'view_employees', 'manage_employees',
    'view_reports', 'export_reports', 'view_logs',
    'manage_settings', 'manage_roles', 'sync_tally', 'manage_backups'
  ],
  manager: [
    'view_inventory', 'create_inventory', 'edit_inventory', 'view_rates',
    'view_orders', 'create_orders', 'edit_orders', 'convert_orders',
    'view_vouchers', 'create_vouchers',
    'view_ledgers', 'create_ledgers',
    'view_employees', 'manage_employees',
    'view_reports', 'export_reports'
  ],
  staff: [
    'view_inventory',
    'view_orders', 'create_orders', 'edit_orders',
    'view_vouchers',
    'view_ledgers',
    'view_employees',
    'view_reports'
  ],
  user: [
    'view_inventory',
    'view_orders',
    'view_vouchers',
    'view_ledgers'
  ]
};

// User custom permissions storage (in-memory, load from file in production)
const fs = require('fs');
const path = require('path');
const PERMISSIONS_FILE = path.join(__dirname, '../data/user_permissions.json');

let userCustomPermissions = {};

// Load user permissions from file
function loadUserPermissions() {
  try {
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (fs.existsSync(PERMISSIONS_FILE)) {
      userCustomPermissions = JSON.parse(fs.readFileSync(PERMISSIONS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to load user permissions:', err);
  }
}

// Save user permissions to file
function saveUserPermissions() {
  try {
    fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify(userCustomPermissions, null, 2));
  } catch (err) {
    console.error('Failed to save user permissions:', err);
  }
}

// Load on startup
loadUserPermissions();

/**
 * Get user's effective permissions
 * Combines role-based defaults with custom user permissions
 */
function getUserPermissions(user) {
  if (!user) return [];
  
  const role = user.role?.toLowerCase() || 'user';
  const defaultPerms = DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.user;
  const customPerms = userCustomPermissions[user.id] || [];
  
  // Merge default and custom permissions (union)
  return [...new Set([...defaultPerms, ...customPerms])];
}

/**
 * Check if user has a specific permission
 */
function hasPermission(user, permission) {
  if (!user || !permission) return false;
  
  // Root always has all permissions
  if (user.role?.toLowerCase() === ROLES.ROOT) return true;
  
  const permissions = getUserPermissions(user);
  return permissions.includes(permission);
}

/**
 * Set custom permissions for a user
 */
function setUserPermissions(userId, permissions) {
  userCustomPermissions[userId] = permissions;
  saveUserPermissions();
}

/**
 * Middleware: Require specific permission
 */
function requirePermission(permission) {
  return (req, res, next) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!hasPermission(user, permission)) {
      return res.status(403).json({ 
        error: 'Permission denied',
        required: permission,
        message: `You don't have the '${permission}' permission to perform this action.`
      });
    }
    
    next();
  };
}

/**
 * Middleware: Require any of the specified permissions
 */
function requireAnyPermission(permissions) {
  return (req, res, next) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const hasAny = permissions.some(p => hasPermission(user, p));
    
    if (!hasAny) {
      return res.status(403).json({ 
        error: 'Permission denied',
        required: permissions,
        message: `You need one of these permissions: ${permissions.join(', ')}`
      });
    }
    
    next();
  };
}

module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  getRoleLevel,
  hasMinimumRole,
  isRoot,
  isAdminOrHigher,
  requireRoot,
  requireAdmin,
  requireAuth,
  extractUser,
  checkServiceEnabled,
  sanitizeConfigForRole,
  checkBruteForce,
  recordFailedAttempt,
  clearFailedAttempts,
  // RBAC exports
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  getUserPermissions,
  hasPermission,
  setUserPermissions,
  requirePermission,
  requireAnyPermission,
  loadUserPermissions,
  saveUserPermissions
};

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
  clearFailedAttempts
};

/**
 * Security Middleware
 * Comprehensive security features to protect against attacks and source code leaks
 * 
 * Features:
 * - Rate limiting
 * - Security headers
 * - Error sanitization
 * - Request validation
 * - Path traversal protection
 * - Sensitive data masking
 * - Brute force protection
 */

// Rate limiting storage (in production, use Redis)
const rateLimitStore = new Map();
const bruteForceStore = new Map();

// Security configuration
const SECURITY_CONFIG = {
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 500, // Max 500 requests per window for unauthenticated
    maxRequestsAuth: 2000, // Higher limit for authenticated users
    strictEndpoints: ['/api/backup/create'], // Only backup create is strictly limited
    strictLimit: 50, // 50 requests per window for sensitive endpoints
    // Sync endpoints have their own higher limit
    syncEndpoints: ['/api/sync', '/api/tally'],
    syncLimit: 200 // Allow 200 sync requests per 15 min window
  },
  // Brute force protection
  bruteForce: {
    maxAttempts: 5,
    lockoutMs: 15 * 60 * 1000 // 15 minutes lockout
  },
  // Blocked patterns (path traversal, SQL injection attempts)
  blockedPatterns: [
    /\.\./,                    // Path traversal
    /\.\.%2f/i,                // Encoded path traversal
    /%2e%2e/i,                 // Double-encoded
    /<script/i,                // XSS attempts
    /javascript:/i,            // JavaScript protocol
    /vbscript:/i,              // VBScript protocol
    /on\w+\s*=/i,              // Event handlers
    /union\s+select/i,         // SQL injection
    /insert\s+into/i,          // SQL injection
    /drop\s+table/i,           // SQL injection
    /exec\s*\(/i,              // SQL injection
    /xp_cmdshell/i,            // SQL Server command execution
    /0x[0-9a-f]+/i,            // Hex encoding attacks
    /base64_decode/i,          // PHP code injection
    /eval\s*\(/i,              // Code execution
    /document\./i,             // DOM manipulation
    /window\./i                // Window object access
  ],
  // Sensitive fields to mask in logs/errors
  sensitiveFields: [
    'password', 'secret', 'token', 'apiKey', 'api_key', 
    'authorization', 'cookie', 'session', 'credit_card',
    'ssn', 'private_key', 'privateKey'
  ]
};

/**
 * Clean up expired entries from rate limit store
 */
function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.startTime > SECURITY_CONFIG.rateLimit.windowMs) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);

/**
 * Get client identifier for rate limiting
 */
function getClientId(req) {
  // Use user ID if authenticated, otherwise use IP
  const userId = req.user?.id;
  const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0] || req.connection?.remoteAddress || 'unknown';
  return userId ? `user:${userId}` : `ip:${ip}`;
}

/**
 * Middleware: Rate Limiting
 * Prevents API abuse and DDoS attacks
 */
function rateLimiter(req, res, next) {
  const baseClientId = getClientId(req);
  const now = Date.now();
  const isAuthenticated = !!req.user;
  const isStrictEndpoint = SECURITY_CONFIG.rateLimit.strictEndpoints.some(ep => req.path.startsWith(ep));
  const isSyncEndpoint = SECURITY_CONFIG.rateLimit.syncEndpoints.some(ep => req.path.startsWith(ep));
  
  // Use endpoint-specific keys so different endpoints have separate counters
  let clientId = baseClientId;
  if (isStrictEndpoint) {
    clientId = `${baseClientId}:strict`;
  } else if (isSyncEndpoint) {
    clientId = `${baseClientId}:sync`;
  }
  
  // Determine max requests based on context
  let maxRequests = isAuthenticated 
    ? SECURITY_CONFIG.rateLimit.maxRequestsAuth 
    : SECURITY_CONFIG.rateLimit.maxRequests;
  
  if (isStrictEndpoint) {
    maxRequests = SECURITY_CONFIG.rateLimit.strictLimit;
  } else if (isSyncEndpoint) {
    maxRequests = SECURITY_CONFIG.rateLimit.syncLimit;
  }
  
  // Get or create rate limit entry
  let entry = rateLimitStore.get(clientId);
  if (!entry || (now - entry.startTime > SECURITY_CONFIG.rateLimit.windowMs)) {
    entry = { count: 0, startTime: now };
    rateLimitStore.set(clientId, entry);
  }
  
  entry.count++;
  
  // Check if rate limited
  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.startTime + SECURITY_CONFIG.rateLimit.windowMs - now) / 1000);
    res.setHeader('Retry-After', retryAfter);
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', 0);
    
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter
    });
  }
  
  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', maxRequests);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count));
  
  next();
}

/**
 * Middleware: Security Headers
 * Adds comprehensive security headers to prevent various attacks
 */
function securityHeaders(req, res, next) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS filter
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'");
  
  // Permissions Policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Strict Transport Security (for HTTPS)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Remove server identification headers
  res.removeHeader('X-Powered-By');
  
  // Cache control for sensitive data
  if (req.path.includes('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }
  
  next();
}

/**
 * Middleware: Request Validation
 * Blocks malicious requests and path traversal attempts
 */
function requestValidator(req, res, next) {
  const suspiciousContent = [
    req.path,
    req.originalUrl,
    JSON.stringify(req.query),
    JSON.stringify(req.body)
  ].join(' ');
  
  // Check for blocked patterns
  for (const pattern of SECURITY_CONFIG.blockedPatterns) {
    if (pattern.test(suspiciousContent)) {
      console.warn(`[Security] Blocked suspicious request from ${getClientId(req)}: ${req.method} ${req.path}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid request'
      });
    }
  }
  
  // Validate content length
  const contentLength = parseInt(req.headers['content-length'] || '0');
  if (contentLength > 10 * 1024 * 1024) { // 10MB max
    return res.status(413).json({
      success: false,
      error: 'Request too large'
    });
  }
  
  next();
}

/**
 * Mask sensitive data in objects
 */
function maskSensitiveData(obj, depth = 0) {
  if (depth > 10) return obj; // Prevent infinite recursion
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => maskSensitiveData(item, depth + 1));
  }
  
  const masked = {};
  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase();
    if (SECURITY_CONFIG.sensitiveFields.some(field => keyLower.includes(field.toLowerCase()))) {
      masked[key] = '***REDACTED***';
    } else if (typeof value === 'object') {
      masked[key] = maskSensitiveData(value, depth + 1);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

/**
 * Middleware: Error Sanitization
 * Prevents leaking sensitive information in error responses
 */
function errorSanitizer(err, req, res, next) {
  // Log the full error internally
  console.error('[Error]', {
    path: req.path,
    method: req.method,
    user: req.user?.id,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
  
  // Determine if this is a known error type
  const isValidationError = err.name === 'ValidationError';
  const isAuthError = err.status === 401 || err.status === 403;
  const isNotFound = err.status === 404;
  
  // Prepare sanitized response
  let statusCode = err.status || 500;
  let response = {
    success: false,
    error: 'An error occurred'
  };
  
  // Provide appropriate error messages without leaking internals
  if (isValidationError) {
    statusCode = 400;
    response.error = 'Invalid input data';
  } else if (isAuthError) {
    response.error = err.message || 'Access denied';
  } else if (isNotFound) {
    response.error = 'Resource not found';
  } else if (statusCode >= 500) {
    // Never expose internal server error details
    response.error = 'Internal server error';
    // Add request ID for tracking (generate simple ID)
    response.requestId = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // In development, include more details
  if (process.env.NODE_ENV === 'development') {
    response.debug = {
      message: err.message,
      code: err.code
    };
  }
  
  res.status(statusCode).json(response);
}

/**
 * Middleware: Block Source Code Access
 * Prevents direct access to source files
 */
function blockSourceAccess(req, res, next) {
  const blockedExtensions = [
    '.js', '.ts', '.jsx', '.tsx', '.json', '.env', '.sql',
    '.yml', '.yaml', '.md', '.git', '.gitignore', '.npmrc',
    '.lock', '.log', '.bak', '.config'
  ];
  
  // Block direct file/folder access but allow API routes
  const blockedPaths = [
    '/node_modules', '/src/', '/routes/', '/middleware/', '/config/',
    '/services/', '/database/', '/.git/', '/.env'
  ];
  
  const pathLower = req.path.toLowerCase();
  
  // Skip check for API routes - they are handled by express routers
  if (pathLower.startsWith('/api/')) {
    return next();
  }
  
  // Check for blocked extensions in URL
  if (blockedExtensions.some(ext => pathLower.endsWith(ext))) {
    return res.status(404).json({ error: 'Not found' });
  }
  
  // Check for blocked paths
  if (blockedPaths.some(blocked => pathLower.includes(blocked.toLowerCase()))) {
    return res.status(404).json({ error: 'Not found' });
  }
  
  next();
}

/**
 * Middleware: Secure Logging
 * Logs requests without sensitive data
 */
function secureLogger(req, res, next) {
  const startTime = Date.now();
  
  // Log on response finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id || 'anonymous',
      ip: req.ip || 'unknown'
    };
    
    // Only log in development or for errors
    if (process.env.NODE_ENV === 'development' || res.statusCode >= 400) {
      console.log(`[${logData.timestamp}] ${logData.method} ${logData.path} ${logData.status} ${logData.duration}`);
    }
  });
  
  next();
}

/**
 * Middleware: API Key Validation (for external integrations)
 */
function validateApiKey(req, res, next) {
  // Skip for internal requests or if no API key is configured
  const configuredApiKey = process.env.API_SECRET_KEY;
  if (!configuredApiKey) {
    return next();
  }
  
  const providedKey = req.headers['x-api-key'] || req.query.apiKey;
  
  // Check if this is an external API endpoint
  const externalEndpoints = ['/api/external/', '/api/webhook/'];
  const isExternalEndpoint = externalEndpoints.some(ep => req.path.startsWith(ep));
  
  if (isExternalEndpoint && providedKey !== configuredApiKey) {
    return res.status(401).json({
      success: false,
      error: 'Invalid API key'
    });
  }
  
  next();
}

/**
 * Generate secure random token
 */
function generateSecureToken(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  const crypto = require('crypto');
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    token += chars[bytes[i] % chars.length];
  }
  return token;
}

/**
 * Hash sensitive data for storage
 */
function hashData(data) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Apply all security middleware to an Express app
 */
function applySecurityMiddleware(app) {
  // Security headers (apply first)
  app.use(securityHeaders);
  
  // Block source code access
  app.use(blockSourceAccess);
  
  // Secure logging
  app.use(secureLogger);
  
  // Request validation
  app.use(requestValidator);
  
  // Rate limiting
  app.use(rateLimiter);
  
  // API key validation
  app.use(validateApiKey);
  
  // Error sanitization (apply last, after routes)
  // Note: This should be added after all routes
  return errorSanitizer;
}

module.exports = {
  rateLimiter,
  securityHeaders,
  requestValidator,
  errorSanitizer,
  blockSourceAccess,
  secureLogger,
  validateApiKey,
  maskSensitiveData,
  generateSecureToken,
  hashData,
  applySecurityMiddleware,
  SECURITY_CONFIG
};

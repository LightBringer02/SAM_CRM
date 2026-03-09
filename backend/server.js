// backend/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const inventoryRoutes = require('./routes/inventory');
const vouchersRoutes = require('./routes/vouchers');
const ledgersRoutes = require('./routes/ledgers');
const systemConfigRoutes = require('./routes/systemConfig');
const syncRoutes = require('./routes/sync');
const blacklistRoutes = require('./routes/blacklist');
const permissionsRoutes = require('./routes/permissions');
const tallyRoutes = require('./routes/tally');
const { extractUser, checkServiceEnabled } = require('./middleware/authMiddleware');
const { applySecurityMiddleware } = require('./middleware/securityMiddleware');

// Import database module routes
let queueRoutes, backupRoutes, fetchRoutes, databaseRoutes, dbModule;
try {
  const dbRoutes = require('../database/routes');
  queueRoutes = dbRoutes.queueRoutes;
  backupRoutes = dbRoutes.backupRoutes;
  fetchRoutes = dbRoutes.fetchRoutes;
  databaseRoutes = dbRoutes.databaseRoutes;
  dbModule = require('../database');
} catch (err) {
  console.warn('Database module not available:', err.message);
}

const app = express();

// ========================================
// SECURITY MIDDLEWARE (Apply first)
// ========================================

// Apply security middleware and get error handler
const errorSanitizer = applySecurityMiddleware(app);

// Disable Express fingerprinting
app.disable('x-powered-by');

// Trust proxy for cloud deployments (Railway, Render, etc.)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// CORS with dynamic configuration for cloud
const getAllowedOrigins = () => {
  const origins = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:4000'];
  
  // Add custom CORS origins from environment
  if (process.env.CORS_ORIGIN) {
    const envOrigins = process.env.CORS_ORIGIN.split(',').map(o => o.trim());
    origins.push(...envOrigins);
  }
  
  // Add frontend URL if specified
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }
  
  return origins;
};

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      // In production, allow any *.trycloudflare.com or configured domains
      if (origin.includes('.trycloudflare.com') || origin.includes('.railway.app') || origin.includes('.render.com') || origin.includes('.vercel.app')) {
        callback(null, true);
      } else {
        callback(null, true); // Be permissive for now - tighten later if needed
      }
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-role', 'x-username', 'x-api-key'],
  credentials: true,
  maxAge: 86400 // 24 hours
};
app.use(cors(corsOptions));

// Body parser with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Extract user info from headers for all requests
app.use(extractUser);

// System Configuration API (ROOT-only for modifications) - bypasses service check
app.use('/api/system-config', systemConfigRoutes);

// Sync API (requires admin, has its own service check handling)
app.use('/api/sync', syncRoutes);

// Database module routes (ROOT-only) - bypasses service check
if (queueRoutes) {
  app.use('/api/queue', queueRoutes);
}
if (backupRoutes) {
  app.use('/api/backup', backupRoutes);
}
if (fetchRoutes) {
  app.use('/api/fetch', fetchRoutes);
}
if (databaseRoutes) {
  app.use('/api/database', databaseRoutes);
}

// Apply service enabled check for main business routes
// ROOT users bypass this check automatically
app.use(checkServiceEnabled);

// Inventory API
app.use('/api/inventory', inventoryRoutes);
// Vouchers API
app.use('/api/vouchers', vouchersRoutes);
// Ledgers API
app.use('/api/ledgers', ledgersRoutes);
// Blacklist API (admin only for modifications)
app.use('/api/blacklist', blacklistRoutes);
// Permissions API (RBAC)
app.use('/api/permissions', permissionsRoutes);
// Tally API (create vouchers, etc.)
app.use('/api/tally', tallyRoutes);

// ========================================
// HEALTH & STATUS ENDPOINTS
// ========================================

// Health check endpoint (no auth required, for load balancers)
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API version info (sanitized)
app.get('/api/version', (req, res) => {
  res.json({ 
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// ========================================
// STATIC FILE SERVING (For production)
// ========================================

// Serve frontend build in production
const frontendPath = path.join(__dirname, '../frontend/dist');
const fs = require('fs');

if (fs.existsSync(frontendPath)) {
  console.log('Serving frontend from:', frontendPath);
  app.use(express.static(frontendPath));
  
  // SPA fallback - serve index.html for all non-API routes
  // Using regex to avoid path-to-regexp issues with wildcard
  app.get(/^(?!\/api\/).*/, (req, res, next) => {
    // Skip health check
    if (req.path === '/health') {
      return next();
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
} else {
  console.log('Frontend build not found at:', frontendPath);
  console.log('Run "cd frontend && npm run build" to build the frontend');
}

// ========================================
// 404 HANDLER (for API routes only)
// ========================================
app.use('/api', (req, res, next) => {
  // Only catch unhandled API routes
  res.status(404).json({ success: false, error: 'API endpoint not found' });
});

// ========================================
// ERROR HANDLER (Must be last)
// ========================================
app.use(errorSanitizer);

const PORT = process.env.PORT || 4000;
app.listen(PORT, async () => {
  console.log(`Backend server running on port ${PORT}`);
  
  // Initialize database module if available
  if (dbModule) {
    try {
      const initResult = await dbModule.initialize({
        runMigrations: true,   // Run migrations to create backup tables
        startWorker: true,     // Start queue worker for background jobs
        startBackupScheduler: false
      });
      console.log('Database module initialized:', initResult.success ? 'OK' : initResult.error);
    } catch (err) {
      console.warn('Database module initialization skipped:', err.message);
    }
  }
});
// backend/server.js
const express = require('express');
const cors = require('cors');
const inventoryRoutes = require('./routes/inventory');
const vouchersRoutes = require('./routes/vouchers');
const ledgersRoutes = require('./routes/ledgers');
const systemConfigRoutes = require('./routes/systemConfig');
const syncRoutes = require('./routes/sync');
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

// CORS with strict configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
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
// 404 HANDLER
// ========================================
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
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
        runMigrations: false,  // Set to true to auto-run migrations
        startWorker: false,    // Set to true to auto-start queue worker
        startBackupScheduler: false
      });
      console.log('Database module initialized:', initResult.success ? 'OK' : initResult.error);
    } catch (err) {
      console.warn('Database module initialization skipped:', err.message);
    }
  }
});

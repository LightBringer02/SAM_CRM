/**
 * Sync Controller
 * Handles data synchronization between Tally and PostgreSQL
 * Supports: LOCAL, LIVE, OFFLINE, DUMMY_DATA modes
 * 
 * Features:
 * - SQL Injection Prevention using parameterized queries
 * - Cloud-ready with auto database initialization
 * - Graceful error handling for missing database
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { getConfig, getBackendMode, getTallyUrl, isDummyMode, isOfflineMode } = require('../config/systemConfig');
const { extractUser, requireRoot, requireAdmin, isRoot } = require('../middleware/authMiddleware');
const { getDummyInventory, getDummyVouchers, getDummyCompany } = require('../config/dummyData');

// Import sync service
let tallySyncService;
try {
  tallySyncService = require('../services/tallySyncService');
} catch (err) {
  console.warn('TallySyncService not available:', err.message);
}

// Import database query function with cloud-ready fallback
let dbQuery, dbTransaction, ensureDatabaseExists;
try {
  const dbConnection = require('../../database/sql/connection');
  dbQuery = dbConnection.query;
  dbTransaction = dbConnection.transaction;
} catch (err) {
  console.warn('Database query not available:', err.message);
  dbQuery = async () => ({ rows: [], rowCount: 0 });
  dbTransaction = async (cb) => cb({ query: dbQuery });
}

// Database initialization state
let dbInitialized = false;
let dbInitError = null;

/**
 * Sanitize and validate input to prevent SQL injection
 * @param {string} input - User input to sanitize
 * @param {string} type - Expected type: 'string', 'number', 'identifier'
 * @returns {string|number|null} Sanitized value or null if invalid
 */
function sanitizeInput(input, type = 'string') {
  if (input === null || input === undefined) return null;
  
  switch (type) {
    case 'number':
      const num = Number(input);
      return isNaN(num) ? null : num;
    case 'identifier':
      // Only allow alphanumeric and underscores for table/column names
      const cleaned = String(input).replace(/[^a-zA-Z0-9_]/g, '');
      return cleaned.length > 0 && cleaned.length <= 64 ? cleaned : null;
    case 'string':
    default:
      // Escape dangerous characters and limit length
      return String(input).substring(0, 1000);
  }
}

/**
 * Safe parameterized query wrapper - prevents SQL injection
 * @param {string} sql - SQL query with $1, $2, etc. placeholders
 * @param {Array} params - Parameter values
 * @returns {Promise<Object>} Query result
 */
async function safeQuery(sql, params = []) {
  // Ensure database is ready
  if (!dbInitialized && !dbInitError) {
    await initializeDatabaseIfNeeded();
  }
  
  // If database still not available, return empty result
  if (dbInitError) {
    console.warn('Database not available:', dbInitError);
    return { rows: [], rowCount: 0 };
  }
  
  try {
    return await dbQuery(sql, params);
  } catch (err) {
    // Handle specific database errors gracefully
    if (err.code === '42P01') {
      // Table doesn't exist - try to create it
      console.warn('Table not found, attempting auto-creation...');
      await initializeDatabaseIfNeeded(true);
      return await dbQuery(sql, params);
    }
    throw err;
  }
}

/**
 * Initialize database tables if they don't exist
 * Cloud-ready: Creates tables on first use
 */
async function initializeDatabaseIfNeeded(force = false) {
  if (dbInitialized && !force) return true;
  
  try {
    // Test connection first
    await dbQuery('SELECT 1');
    
    // Create essential tables if they don't exist
    const createTablesSQL = `
      -- Task queue table
      CREATE TABLE IF NOT EXISTS task_queue (
        id SERIAL PRIMARY KEY,
        task_type VARCHAR(50) NOT NULL,
        payload JSONB DEFAULT '{}',
        status VARCHAR(20) DEFAULT 'pending',
        priority INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      -- Sync history table
      CREATE TABLE IF NOT EXISTS sync_history (
        id SERIAL PRIMARY KEY,
        sync_type VARCHAR(50) NOT NULL,
        items_synced INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'completed',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;
    
    await dbQuery(createTablesSQL);
    dbInitialized = true;
    dbInitError = null;
    console.log('Database tables initialized successfully');
    return true;
  } catch (err) {
    dbInitError = err.message;
    console.error('Database initialization failed:', err.message);
    return false;
  }
}

// In-memory sync state
let lastSyncResult = {
  success: false,
  timestamp: null,
  mode: null,
  message: null,
  itemsSynced: 0,
  tallyConnected: false,
  error: null
};

// Apply user extraction middleware
router.use(extractUser);

/**
 * GET /api/sync/status
 * Get current sync status and Tally connection state
 */
router.get('/status', async (req, res) => {
  const config = getConfig();
  
  // Check Tally connection
  let tallyConnected = false;
  if (tallySyncService) {
    tallyConnected = await tallySyncService.checkTallyConnection();
  } else {
    // Fallback check
    try {
      const tallyUrl = getTallyUrl();
      if (tallyUrl) {
        const pingXml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Function</TYPE><ID>$$CurrentCompany</ID></HEADER><BODY></BODY></ENVELOPE>`;
        const response = await axios.post(tallyUrl, pingXml, {
          headers: { 'Content-Type': 'text/xml' },
          timeout: 3000
        });
        tallyConnected = response.status === 200;
      }
    } catch (err) {
      tallyConnected = false;
    }
  }

  // Update lastSyncResult with current connection status
  lastSyncResult.tallyConnected = tallyConnected;

  res.json({
    success: true,
    data: {
      lastSync: lastSyncResult,
      backendMode: config.backendMode,
      serviceEnabled: config.serviceEnabled,
      tallyConnected,
      tallyUrl: isRoot(req.user) ? getTallyUrl() : '(hidden)'
    }
  });
});

/**
 * POST /api/sync/trigger
 * Trigger a full sync operation - syncs Tally data to PostgreSQL
 */
router.post('/trigger', requireAdmin, async (req, res) => {
  const startTime = Date.now();
  const backendMode = getBackendMode();
  
  try {
    let syncedData = {
      inventory: [],
      vouchers: [],
      ledgers: [],
      company: null
    };
    
    let syncMessage = '';
    let tallyConnected = false;
    let syncResults = { ledgers: 0, stockItems: 0, vouchers: 0, groups: 0 };
    
    // Set Tally URL in sync service
    if (tallySyncService) {
      tallySyncService.setTallyUrl(getTallyUrl());
    }

    // STEP 1: Handle based on backend mode
    if (backendMode === 'DUMMY_DATA') {
      // Use dummy data - no Tally connection needed
      syncedData.inventory = getDummyInventory();
      syncedData.vouchers = getDummyVouchers({});
      syncedData.company = getDummyCompany();
      syncMessage = 'Synced with dummy data (no Tally connection)';
      
    } else if (backendMode === 'OFFLINE') {
      // Offline mode - fetch from database
      if (tallySyncService) {
        syncedData.ledgers = await tallySyncService.getLedgersFromDb();
        syncedData.inventory = await tallySyncService.getStockItemsFromDb();
        syncedData.vouchers = await tallySyncService.getVouchersFromDb();
      }
      syncMessage = 'Offline mode - serving data from database';
      
    } else {
      // LOCAL or LIVE mode - attempt Tally connection and sync
      if (tallySyncService) {
        // Perform full sync
        const results = await tallySyncService.fullSync();
        tallyConnected = results.tallyConnected;
        syncResults = results;
        
        if (tallyConnected) {
          syncMessage = `Tally sync completed - ${results.ledgers} ledgers, ${results.stockItems} items, ${results.vouchers} vouchers synced to database`;
          
          // Get synced data for response
          syncedData.ledgers = await tallySyncService.getLedgersFromDb();
          syncedData.inventory = await tallySyncService.getStockItemsFromDb();
          syncedData.vouchers = await tallySyncService.getVouchersFromDb();
        } else {
          // Tally not available - serve from database
          syncedData.ledgers = await tallySyncService.getLedgersFromDb();
          syncedData.inventory = await tallySyncService.getStockItemsFromDb();
          syncedData.vouchers = await tallySyncService.getVouchersFromDb();
          syncMessage = 'Tally offline - serving cached data from database';
        }
      } else {
        // Fallback: try direct Tally connection
        const tallyUrl = getTallyUrl();
        if (tallyUrl) {
          try {
            const pingXml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Companies</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>`;
            await axios.post(tallyUrl, pingXml, {
              headers: { 'Content-Type': 'text/xml' },
              timeout: 5000
            });
            tallyConnected = true;
            syncMessage = `Connected to Tally (${backendMode} mode)`;
          } catch (tallyErr) {
            tallyConnected = false;
            syncMessage = `Tally not available (${backendMode} mode) - using cached data`;
          }
        } else {
          syncMessage = 'No Tally URL configured - using local data';
        }
      }
    }
    
    const syncDuration = Date.now() - startTime;
    
    // Update sync state
    lastSyncResult = {
      success: true,
      timestamp: new Date().toISOString(),
      mode: backendMode,
      message: syncMessage,
      itemsSynced: syncResults.ledgers + syncResults.stockItems + syncResults.vouchers,
      syncDetails: syncResults,
      tallyConnected,
      duration: syncDuration,
      error: null
    };
    
    res.json({
      success: true,
      message: syncMessage,
      data: {
        syncResult: lastSyncResult,
        inventory: syncedData.inventory,
        ledgers: syncedData.ledgers,
        vouchers: syncedData.vouchers,
        company: syncedData.company
      }
    });
    
  } catch (err) {
    const syncDuration = Date.now() - startTime;
    
    lastSyncResult = {
      success: false,
      timestamp: new Date().toISOString(),
      mode: backendMode,
      message: 'Sync failed',
      itemsSynced: 0,
      tallyConnected: false,
      duration: syncDuration,
      error: err.message
    };
    
    res.status(500).json({
      success: false,
      error: 'Sync operation failed',
      details: err.message,
      data: { syncResult: lastSyncResult }
    });
  }
});

/**
 * POST /api/sync/inventory
 * Sync inventory/stock items only
 */
router.post('/inventory', requireAdmin, async (req, res) => {
  const backendMode = getBackendMode();
  
  try {
    let inventory = [];
    let fromDatabase = false;
    
    if (isDummyMode()) {
      inventory = getDummyInventory();
    } else if (isOfflineMode()) {
      // Fetch from database in offline mode
      if (tallySyncService) {
        inventory = await tallySyncService.getStockItemsFromDb();
        fromDatabase = true;
      }
    } else {
      // Attempt to fetch from Tally and sync to database
      if (tallySyncService) {
        const tallyConnected = await tallySyncService.checkTallyConnection();
        if (tallyConnected) {
          const items = await tallySyncService.fetchStockItemsFromTally();
          await tallySyncService.syncStockItemsToDb(items);
          inventory = await tallySyncService.getStockItemsFromDb();
        } else {
          // Fallback to database
          inventory = await tallySyncService.getStockItemsFromDb();
          fromDatabase = true;
        }
      } else {
        // Fallback to existing method
        try {
          const { fetchInventory } = require('../connection/inventory');
          inventory = await fetchInventory();
        } catch (fetchErr) {
          console.warn('Inventory fetch failed:', fetchErr.message);
          inventory = [];
        }
      }
    }
    
    res.json({
      success: true,
      message: `Inventory synced (${backendMode} mode${fromDatabase ? ' - from database' : ''})`,
      data: inventory,
      count: inventory.length,
      fromDatabase
    });
    
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Inventory sync failed',
      details: err.message
    });
  }
});

/**
 * POST /api/sync/vouchers
 * Sync vouchers only
 */
router.post('/vouchers', requireAdmin, async (req, res) => {
  const backendMode = getBackendMode();
  
  try {
    let vouchers = [];
    let fromDatabase = false;
    
    if (isDummyMode()) {
      vouchers = getDummyVouchers(req.query || {});
    } else if (isOfflineMode()) {
      // Fetch from database in offline mode
      if (tallySyncService) {
        vouchers = await tallySyncService.getVouchersFromDb();
        fromDatabase = true;
      }
    } else {
      // Attempt to fetch from Tally and sync to database
      if (tallySyncService) {
        const tallyConnected = await tallySyncService.checkTallyConnection();
        if (tallyConnected) {
          const items = await tallySyncService.fetchVouchersFromTally();
          await tallySyncService.syncVouchersToDb(items);
          vouchers = await tallySyncService.getVouchersFromDb();
        } else {
          // Fallback to database
          vouchers = await tallySyncService.getVouchersFromDb();
          fromDatabase = true;
        }
      } else {
        try {
          const { fetchVouchers } = require('../connection/voucherRegister');
          vouchers = await fetchVouchers();
        } catch (fetchErr) {
          console.warn('Vouchers fetch failed:', fetchErr.message);
          vouchers = [];
        }
      }
    }
    
    res.json({
      success: true,
      message: `Vouchers synced (${backendMode} mode${fromDatabase ? ' - from database' : ''})`,
      data: vouchers,
      count: vouchers.length,
      fromDatabase
    });
    
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Vouchers sync failed',
      details: err.message
    });
  }
});

/**
 * POST /api/sync/ledgers
 * Sync ledgers only
 */
router.post('/ledgers', requireAdmin, async (req, res) => {
  const backendMode = getBackendMode();
  
  try {
    let ledgers = [];
    let fromDatabase = false;
    
    if (isDummyMode()) {
      ledgers = []; // No dummy ledgers
    } else if (isOfflineMode()) {
      if (tallySyncService) {
        ledgers = await tallySyncService.getLedgersFromDb();
        fromDatabase = true;
      }
    } else {
      if (tallySyncService) {
        const tallyConnected = await tallySyncService.checkTallyConnection();
        if (tallyConnected) {
          const items = await tallySyncService.fetchLedgersFromTally();
          await tallySyncService.syncLedgersToDb(items);
          ledgers = await tallySyncService.getLedgersFromDb();
        } else {
          ledgers = await tallySyncService.getLedgersFromDb();
          fromDatabase = true;
        }
      }
    }
    
    res.json({
      success: true,
      message: `Ledgers synced (${backendMode} mode${fromDatabase ? ' - from database' : ''})`,
      data: ledgers,
      count: ledgers.length,
      fromDatabase
    });
    
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Ledgers sync failed',
      details: err.message
    });
  }
});

/**
 * GET /api/sync/last
 * Get last sync result
 */
router.get('/last', (req, res) => {
  res.json({
    success: true,
    data: lastSyncResult
  });
});

/**
 * GET /api/sync/queue
 * Get pending tasks in queue
 */
router.get('/queue', requireAdmin, async (req, res) => {
  try {
    if (tallySyncService) {
      const tasks = await tallySyncService.getPendingTasks();
      res.json({
        success: true,
        data: tasks,
        count: tasks.length
      });
    } else {
      // Fallback to parameterized query (SQL injection safe)
      // Limit is hardcoded to prevent injection via query params
      const limit = 100;
      const result = await safeQuery(
        'SELECT id, task_type, payload, status, priority, created_at, updated_at FROM task_queue ORDER BY priority DESC, created_at ASC LIMIT $1',
        [limit]
      );
      res.json({
        success: true,
        data: result.rows,
        count: result.rows.length
      });
    }
  } catch (err) {
    // Cloud-ready: Return empty data instead of 500 if DB not available
    if (err.code === '42P01' || err.code === 'ECONNREFUSED' || err.message?.includes('database')) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        warning: 'Database temporarily unavailable'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to get queue',
      details: err.message
    });
  }
});

/**
 * POST /api/sync/queue/process
 * Process pending tasks in queue
 */
router.post('/queue/process', requireAdmin, async (req, res) => {
  try {
    if (tallySyncService) {
      // Check if Tally is available first
      const connected = await tallySyncService.checkTallyConnection();
      if (!connected) {
        return res.json({
          success: false,
          message: 'Tally is offline - tasks will be processed when Tally comes back online'
        });
      }
      
      const result = await tallySyncService.processPendingTasks();
      res.json({
        success: true,
        message: `Processed ${result.processed} tasks, ${result.failed} failed`,
        data: result
      });
    } else {
      res.json({
        success: false,
        message: 'Sync service not available'
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Failed to process queue',
      details: err.message
    });
  }
});

/**
 * POST /api/sync/backup
 * Create a backup by syncing all data from Tally to database
 * NO AUTHENTICATION REQUIRED for manual backup
 */
router.post('/backup', async (req, res) => {
  try {
    if (tallySyncService) {
      const results = await tallySyncService.fullSync();
      res.json({
        success: true,
        message: 'Backup created - data synced to database',
        data: results
      });
    } else {
      res.json({
        success: false,
        message: 'Sync service not available'
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Backup failed',
      details: err.message
    });
  }
});

/**
 * POST /api/sync/navbar-sync
 * Enhanced sync for navbar button - NO AUTHENTICATION REQUIRED
 * Checks Tally connection AND syncs data to database if Tally is online
 * For admins: Does full sync. For regular users: Connection check only
 */
router.post('/navbar-sync', async (req, res) => {
  try {
    // Set Tally URL from config (not hardcoded)
    if (tallySyncService) {
      tallySyncService.setTallyUrl(getTallyUrl());
    }
    
    let tallyConnected = false;
    let syncMessage = '';
    let dataSynced = false;
    
    // Check user role from headers (admin users get full sync)
    const userRole = req.headers['x-user-role'] || 'user';
    const isAdminUser = ['root', 'admin'].includes(userRole.toLowerCase());
    
    if (tallySyncService) {
      // Check connection first
      tallyConnected = await tallySyncService.checkTallyConnection();
      
      if (tallyConnected && isAdminUser) {
        // Admin users get full sync when Tally is connected
        try {
          console.log('Navbar sync: Starting data sync for admin user...');
          const syncResult = await tallySyncService.fullSync();
          dataSynced = syncResult.tallyConnected || false;
          syncMessage = dataSynced 
            ? 'Tally connected - Data synced to database' 
            : 'Tally connected - ' + (syncResult.errors?.join(', ') || 'Sync completed with warnings');
        } catch (syncErr) {
          console.error('Navbar sync data error:', syncErr.message);
          syncMessage = 'Tally connected - Sync error: ' + syncErr.message;
          dataSynced = false;
        }
      } else if (tallyConnected) {
        syncMessage = 'Tally is connected and live';
      } else {
        syncMessage = 'Tally is offline - using cached data';
      }
    } else {
      // Fallback Tally check
      try {
        const tallyUrl = getTallyUrl();
        if (tallyUrl) {
          const pingXml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Function</TYPE><ID>$$CurrentCompany</ID></HEADER><BODY></BODY></ENVELOPE>`;
          const response = await axios.post(tallyUrl, pingXml, {
            headers: { 'Content-Type': 'text/xml' },
            timeout: 3000
          });
          tallyConnected = response.status === 200;
        }
      } catch {
        tallyConnected = false;
      }
      syncMessage = tallyConnected ? 'Tally connected' : 'Tally offline';
    }
    
    // Update last sync state
    lastSyncResult = {
      ...lastSyncResult,
      tallyConnected,
      dataSynced,
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      message: syncMessage,
      tallyConnected,
      dataSynced,
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('Navbar sync error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Status check failed',
      details: err.message,
      tallyConnected: false,
      dataSynced: false
    });
  }
});

/**
 * GET /api/sync/db-status
 * Check database connection status
 * Cloud-ready: Attempts auto-initialization if database is missing
 */
router.get('/db-status', async (req, res) => {
  try {
    // Try to initialize database if not done
    await initializeDatabaseIfNeeded();
    
    const result = await safeQuery('SELECT NOW() as now, current_database() as database');
    res.json({
      success: true,
      connected: true,
      initialized: dbInitialized,
      database: result.rows[0]?.database,
      timestamp: result.rows[0]?.now
    });
  } catch (err) {
    // Don't return 500 - this is informational
    res.json({
      success: false,
      connected: false,
      initialized: dbInitialized,
      error: err.code === 'ECONNREFUSED' 
        ? 'Database server not running'
        : err.code === '3D000'
        ? 'Database does not exist'
        : err.message,
      hint: 'Database will be auto-initialized on first write operation'
    });
  }
});

/**
 * POST /api/sync/test-tally
 * Test connection to Tally with custom URL
 */
router.post('/test-tally', async (req, res) => {
  try {
    const { url } = req.body;
    // Use provided URL, or get from config, or use default from config
    const config = getConfig();
    const defaultTallyUrl = config.tallyUrl || 'http://localhost:9000';
    const testUrl = url || getTallyUrl() || defaultTallyUrl;
    
    // Try to connect to Tally using simple company list request
    const response = await axios.post(testUrl, 
      `<ENVELOPE>
        <HEADER>
          <VERSION>1</VERSION>
          <TALLYREQUEST>Export</TALLYREQUEST>
          <TYPE>Collection</TYPE>
          <ID>List of Companies</ID>
        </HEADER>
        <BODY>
          <DESC>
            <STATICVARIABLES>
              <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            </STATICVARIABLES>
          </DESC>
        </BODY>
      </ENVELOPE>`,
      {
        headers: { 'Content-Type': 'application/xml' },
        timeout: 10000
      }
    );
    
    // Check if we got a valid response
    const hasValidResponse = response.data && 
      (response.data.includes('ENVELOPE') || response.data.includes('COMPANY') || response.status === 200);
    
    res.json({
      success: true,
      connected: hasValidResponse,
      message: hasValidResponse ? 'Tally connection successful!' : 'Connected but response invalid',
      url: testUrl
    });
  } catch (err) {
    res.json({
      success: false,
      connected: false,
      error: err.code === 'ECONNREFUSED' 
        ? 'Connection refused - Tally may not be running' 
        : err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED'
        ? 'Connection timed out - check if Tally is accessible'
        : err.message,
      url: req.body?.url || getTallyUrl()
    });
  }
});

/**
 * POST /api/sync/test-database
 * Test connection to PostgreSQL database with custom config
 * Cloud-ready: Can create database if it doesn't exist
 */
router.post('/test-database', async (req, res) => {
  // Sanitize inputs to prevent injection
  const host = sanitizeInput(req.body.host, 'string') || 'localhost';
  const port = sanitizeInput(req.body.port, 'number') || 5432;
  const name = sanitizeInput(req.body.name, 'identifier') || 'samcrm';
  const user = sanitizeInput(req.body.user, 'string') || 'postgres';
  const password = req.body.password || ''; // Password can contain special chars
  const createIfMissing = req.body.createIfMissing === true;
  
  // Use the pg module from database folder
  let Pool;
  try {
    Pool = require('../../database/node_modules/pg').Pool;
  } catch (e1) {
    try {
      Pool = require('pg').Pool;
    } catch (e2) {
      // Fallback: just test using the existing dbQuery
      try {
        const result = await safeQuery('SELECT current_database() as db, current_user as user, NOW() as timestamp');
        return res.json({
          success: true,
          connected: true,
          message: 'Database connection successful (using existing connection)!',
          database: result.rows[0]?.db,
          user: result.rows[0]?.user,
          timestamp: result.rows[0]?.timestamp
        });
      } catch (err) {
        return res.json({
          success: false,
          connected: false,
          error: err.message
        });
      }
    }
  }
  
  const testPool = new Pool({
    host,
    port,
    database: name,
    user,
    password,
    connectionTimeoutMillis: 10000,
    // SSL for cloud databases
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
  });
  
  try {
    const client = await testPool.connect();
    const result = await client.query('SELECT current_database() as db, current_user as user, NOW() as timestamp');
    client.release();
    await testPool.end();
    
    res.json({
      success: true,
      connected: true,
      message: 'Database connection successful!',
      database: result.rows[0]?.db,
      user: result.rows[0]?.user,
      timestamp: result.rows[0]?.timestamp
    });
  } catch (err) {
    await testPool.end().catch(() => {});
    
    // If database doesn't exist and createIfMissing is true, try to create it
    if (err.code === '3D000' && createIfMissing) {
      try {
        // Connect to default 'postgres' database to create the target database
        const adminPool = new Pool({
          host,
          port,
          database: 'postgres',
          user,
          password,
          connectionTimeoutMillis: 10000,
          ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
        });
        
        const adminClient = await adminPool.connect();
        // Use parameterized identifier - database names can't use $1 so we validate
        if (name && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
          await adminClient.query(`CREATE DATABASE ${name}`);
          adminClient.release();
          await adminPool.end();
          
          return res.json({
            success: true,
            connected: true,
            created: true,
            message: `Database '${name}' created successfully!`,
            database: name
          });
        } else {
          adminClient.release();
          await adminPool.end();
          throw new Error('Invalid database name');
        }
      } catch (createErr) {
        return res.json({
          success: false,
          connected: false,
          error: `Failed to create database: ${createErr.message}`
        });
      }
    }
    
    res.json({
      success: false,
      connected: false,
      error: err.code === 'ECONNREFUSED' 
        ? 'Connection refused - PostgreSQL may not be running'
        : err.code === '28P01'
        ? 'Authentication failed - check username/password'
        : err.code === '3D000'
        ? 'Database does not exist - set createIfMissing: true to auto-create'
        : err.message,
      canCreate: err.code === '3D000'
    });
  }
});

module.exports = router;

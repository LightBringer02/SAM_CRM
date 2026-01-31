/**
 * PostgreSQL Connection Handler
 * Manages database connections with pooling and reconnection logic
 * 
 * Cloud-Ready Features:
 * - SSL support for cloud databases
 * - Auto-retry on connection failure
 * - Graceful handling of missing database
 * - Environment variable configuration support
 */

const { Pool } = require('pg');
const path = require('path');

// Try to load system config if available
let getConfig;
try {
  getConfig = require('../../backend/config/systemConfig').getConfig;
} catch (err) {
  getConfig = null;
}

// Default database configuration
const DEFAULT_DB_CONFIG = {
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT) || 5432,
  database: process.env.DATABASE_NAME || 'samcrm',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'root',
  max: 20, // Maximum pool connections (update if needed)
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  // Cloud-ready: SSL configuration
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
};

let pool = null;
let connectionAttempts = 0;
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Get database configuration from system config or defaults
 * Supports environment variables for cloud deployment
 */
function getDatabaseConfig() {
  // Priority: Environment variables > System config > Defaults
  const config = {
    host: process.env.DATABASE_HOST || DEFAULT_DB_CONFIG.host,
    port: parseInt(process.env.DATABASE_PORT) || DEFAULT_DB_CONFIG.port,
    database: process.env.DATABASE_NAME || DEFAULT_DB_CONFIG.database,
    user: process.env.DATABASE_USER || DEFAULT_DB_CONFIG.user,
    password: process.env.DATABASE_PASSWORD || DEFAULT_DB_CONFIG.password,
    max: DEFAULT_DB_CONFIG.max,
    idleTimeoutMillis: DEFAULT_DB_CONFIG.idleTimeoutMillis,
    connectionTimeoutMillis: DEFAULT_DB_CONFIG.connectionTimeoutMillis,
    ssl: DEFAULT_DB_CONFIG.ssl
  };

  if (getConfig) {
    try {
      const sysConfig = getConfig();
      return {
        host: sysConfig.database?.host || config.host,
        port: sysConfig.database?.port || config.port,
        database: sysConfig.database?.name || config.database,
        user: sysConfig.database?.user || config.user,
        password: sysConfig.database?.password || config.password,
        max: config.max,
        idleTimeoutMillis: config.idleTimeoutMillis,
        connectionTimeoutMillis: config.connectionTimeoutMillis,
        ssl: config.ssl
      };
    } catch (err) {
      console.warn('Could not load system config, using defaults:', err.message);
    }
  }
  return config;
}

/**
 * Initialize connection pool
 */
function initPool() {
  if (pool) {
    return pool;
  }

  const config = getDatabaseConfig();
  pool = new Pool(config);

  pool.on('error', (err, client) => {
    console.error('Unexpected error on idle PostgreSQL client:', err);
  });

  pool.on('connect', () => {
    console.log('PostgreSQL client connected');
  });

  return pool;
}

/**
 * Get the connection pool (initializes if needed)
 */
function getPool() {
  if (!pool) {
    initPool();
  }
  return pool;
}

/**
 * Execute a query with automatic connection handling
 * Cloud-ready: Auto-retry and graceful error handling
 * @param {string} text - SQL query text with parameterized placeholders ($1, $2, etc.)
 * @param {Array} params - Query parameters (prevents SQL injection)
 * @returns {Promise<Object>} Query result
 */
async function query(text, params = []) {
  let currentPool = getPool();
  const start = Date.now();
  
  try {
    const result = await currentPool.query(text, params);
    const duration = Date.now() - start;
    
    // Reset connection attempts on success
    connectionAttempts = 0;
    
    // Log slow queries (over 1 second)
    if (duration > 1000) {
      console.warn('Slow query detected:', { text: text.substring(0, 100), duration, rows: result.rowCount });
    }
    
    return result;
  } catch (err) {
    // Handle connection errors with retry
    if ((err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') && connectionAttempts < MAX_RETRY_ATTEMPTS) {
      connectionAttempts++;
      console.warn(`Database connection failed, attempt ${connectionAttempts}/${MAX_RETRY_ATTEMPTS}...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * connectionAttempts));
      // Reinitialize pool and retry
      pool = null;
      return query(text, params);
    }
    
    console.error('Query error:', { text: text.substring(0, 100), error: err.message, code: err.code });
    throw err;
  }
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise<Object>} PostgreSQL client
 */
async function getClient() {
  const pool = getPool();
  const client = await pool.connect();
  
  // Wrap release to track unreleased clients
  const originalRelease = client.release;
  const timeout = setTimeout(() => {
    console.warn('Client has been checked out for more than 5 seconds!');
  }, 5000);
  
  client.release = () => {
    clearTimeout(timeout);
    return originalRelease.apply(client);
  };
  
  return client;
}

/**
 * Execute a transaction with automatic rollback on error
 * @param {Function} callback - Function receiving client
 * @returns {Promise<*>} Transaction result
 */
async function transaction(callback) {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Test database connection
 * @returns {Promise<boolean>} Connection status
 */
async function testConnection() {
  try {
    const result = await query('SELECT NOW() as now');
    return { connected: true, timestamp: result.rows[0].now };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

/**
 * Close all pool connections
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('PostgreSQL pool closed');
  }
}

/**
 * Reinitialize pool with new config
 */
async function reinitializePool() {
  await closePool();
  initPool();
  return testConnection();
}

/**
 * Ensure database exists, create if missing (for cloud deployment)
 * @param {string} dbName - Database name to create
 * @returns {Promise<Object>} Result with created status
 */
async function ensureDatabaseExists(dbName) {
  const config = getDatabaseConfig();
  const targetDb = dbName || config.database;
  
  // Validate database name to prevent SQL injection
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(targetDb)) {
    throw new Error('Invalid database name');
  }
  
  // Try to connect to target database first
  const testPool = new Pool({
    ...config,
    database: targetDb,
    connectionTimeoutMillis: 5000
  });
  
  try {
    await testPool.query('SELECT 1');
    await testPool.end();
    return { exists: true, created: false, database: targetDb };
  } catch (err) {
    await testPool.end().catch(() => {});
    
    if (err.code === '3D000') {
      // Database doesn't exist - create it
      const adminPool = new Pool({
        ...config,
        database: 'postgres' // Connect to default database
      });
      
      try {
        // Create the database (name is already validated)
        await adminPool.query(`CREATE DATABASE ${targetDb}`);
        await adminPool.end();
        console.log(`Database '${targetDb}' created successfully`);
        return { exists: true, created: true, database: targetDb };
      } catch (createErr) {
        await adminPool.end().catch(() => {});
        throw new Error(`Failed to create database: ${createErr.message}`);
      }
    }
    throw err;
  }
}

/**
 * Initialize database schema from SQL file
 * @returns {Promise<boolean>} Success status
 */
async function initializeSchema() {
  const fs = require('fs');
  const initSqlPath = path.join(__dirname, 'init.sql');
  
  try {
    if (fs.existsSync(initSqlPath)) {
      const sql = fs.readFileSync(initSqlPath, 'utf8');
      await query(sql);
      console.log('Database schema initialized from init.sql');
      return true;
    }
    console.warn('init.sql not found, skipping schema initialization');
    return false;
  } catch (err) {
    console.error('Schema initialization error:', err.message);
    throw err;
  }
}

module.exports = {
  getPool,
  query,
  getClient,
  transaction,
  testConnection,
  closePool,
  reinitializePool,
  getDatabaseConfig,
  ensureDatabaseExists,
  initializeSchema
};

/**
 * System Configuration Service
 * Manages Tally URL, DB settings, limits, and backend-mode flag.
 * Can only be modified by ROOT users.
 */

const fs = require('fs');
const path = require('path');

// Config file path
const CONFIG_FILE_PATH = path.join(__dirname, 'system-config.json');

// Default configuration
const DEFAULT_CONFIG = {
  // Tally connection settings
  tallyUrl: 'http://localhost:9000',
  
  // Database connection settings
  database: {
    host: 'localhost',
    port: 5432,
    name: 'postgres',
    user: 'postgres',
    password: 'root'
  },
  
  // Creation limits (removed maxUsersPerAdmin)
  limits: {
    maxAdmins: 5,
    maxTotalUsers: 200
  },
  
  // Backend mode: 'LOCAL', 'LIVE', 'OFFLINE', or 'DUMMY_DATA'
  backendMode: 'LIVE',
  
  // Live server endpoint (used when backendMode is 'LIVE')
  liveServerUrl: 'https://ipod-showing-trends-rid.trycloudflare.com/',
  
  // Service enabled flag - when false, blocks all non-root requests
  serviceEnabled: true,
  
  // Last updated timestamp
  lastUpdated: null,
  updatedBy: null
};

// In-memory config cache
let configCache = null;

/**
 * Get configuration from environment variables (for cloud deployments)
 * Environment variables take precedence over file-based config
 */
function getEnvConfig() {
  const envConfig = {};
  
  // Tally URL
  if (process.env.TALLY_URL) {
    envConfig.tallyUrl = process.env.TALLY_URL;
  }
  
  // Live Server URL
  if (process.env.LIVE_SERVER_URL) {
    envConfig.liveServerUrl = process.env.LIVE_SERVER_URL;
  }
  
  // Backend Mode
  if (process.env.BACKEND_MODE) {
    envConfig.backendMode = process.env.BACKEND_MODE;
  }
  
  // Database settings
  if (process.env.DATABASE_HOST || process.env.DATABASE_URL) {
    envConfig.database = {
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT) || 5432,
      name: process.env.DATABASE_NAME || 'samcrm',
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || ''
    };
    
    // Parse DATABASE_URL if provided (Heroku/Railway style)
    if (process.env.DATABASE_URL) {
      try {
        const url = new URL(process.env.DATABASE_URL);
        envConfig.database = {
          host: url.hostname,
          port: parseInt(url.port) || 5432,
          name: url.pathname.slice(1),
          user: url.username,
          password: url.password
        };
      } catch (e) {
        console.warn('Could not parse DATABASE_URL:', e.message);
      }
    }
  }
  
  // Limits
  if (process.env.MAX_ADMINS || process.env.MAX_TOTAL_USERS) {
    envConfig.limits = {
      maxAdmins: parseInt(process.env.MAX_ADMINS) || 5,
      maxTotalUsers: parseInt(process.env.MAX_TOTAL_USERS) || 200
    };
  }
  
  // Service enabled
  if (process.env.SERVICE_ENABLED !== undefined) {
    envConfig.serviceEnabled = process.env.SERVICE_ENABLED !== 'false';
  }
  
  return envConfig;
}

/**
 * Load configuration from file
 * Auto-creates default config if none exists - never throws error
 * Environment variables take precedence over file-based config
 */
function loadConfig() {
  try {
    // Start with defaults
    configCache = { ...DEFAULT_CONFIG };
    
    // Try to load from file
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const data = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
      const parsed = JSON.parse(data);
      // Merge with defaults to ensure all fields exist (handles upgrades)
      configCache = { 
        ...DEFAULT_CONFIG, 
        ...parsed,
        // Deep merge for nested objects
        database: { ...DEFAULT_CONFIG.database, ...(parsed.database || {}) },
        limits: { ...DEFAULT_CONFIG.limits, ...(parsed.limits || {}) }
      };
    }
    
    // Apply environment variables (take precedence)
    const envConfig = getEnvConfig();
    if (Object.keys(envConfig).length > 0) {
      configCache = {
        ...configCache,
        ...envConfig,
        database: { ...configCache.database, ...(envConfig.database || {}) },
        limits: { ...configCache.limits, ...(envConfig.limits || {}) }
      };
      console.log('Applied environment config overrides');
    }
    
    // Remove deprecated fields
    if (configCache.limits.maxUsersPerAdmin !== undefined) {
      delete configCache.limits.maxUsersPerAdmin;
    }
    // Ensure serviceEnabled exists
    if (configCache.serviceEnabled === undefined) {
      configCache.serviceEnabled = true;
    }
    
    // Try to save if file doesn't exist (may fail on read-only filesystems)
    if (!fs.existsSync(CONFIG_FILE_PATH)) {
      try {
        saveConfig(configCache);
      } catch (e) {
        console.log('Config file not created (filesystem may be read-only):', e.message);
      }
    }
  } catch (err) {
    console.warn('Config load warning (using defaults + env):', err.message);
    configCache = { ...DEFAULT_CONFIG, ...getEnvConfig() };
    // Try to create the config file
    try {
      saveConfig(configCache);
    } catch (saveErr) {
      console.warn('Could not save default config:', saveErr.message);
    }
  }
  return configCache;
}

/**
 * Save configuration to file
 * Note: On cloud platforms with read-only filesystems, this will fail
 * Use environment variables for cloud configuration instead
 */
function saveConfig(config) {
  try {
    // Ensure directory exists
    const dir = path.dirname(CONFIG_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write to a temp file first, then rename (atomic write)
    const tempPath = CONFIG_FILE_PATH + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(config, null, 2), 'utf8');
    
    // Rename temp file to actual file (atomic on most systems)
    fs.renameSync(tempPath, CONFIG_FILE_PATH);
    
    configCache = config;
    console.log('System config saved successfully');
    return true;
  } catch (err) {
    console.error('Error saving system config:', err.message);
    
    // Check for read-only filesystem errors (common on cloud platforms)
    if (err.code === 'EROFS' || err.code === 'EACCES' || err.code === 'EPERM') {
      // Update in-memory cache even if file save fails
      configCache = config;
      console.log('Config updated in memory (file system is read-only)');
      
      // Throw a more informative error for cloud deployments
      const cloudError = new Error('Cannot save config: File system is read-only. Use environment variables for cloud configuration.');
      cloudError.code = 'CLOUD_READONLY';
      throw cloudError;
    }
    
    // Try direct write as fallback
    try {
      fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), 'utf8');
      configCache = config;
      console.log('System config saved (fallback method)');
      return true;
    } catch (fallbackErr) {
      console.error('Fallback save also failed:', fallbackErr.message);
      // Update cache anyway for current session
      configCache = config;
      
      if (fallbackErr.code === 'EROFS' || fallbackErr.code === 'EACCES' || fallbackErr.code === 'EPERM') {
        const cloudError = new Error('Cannot save config: File system is read-only. Use environment variables for cloud configuration.');
        cloudError.code = 'CLOUD_READONLY';
        throw cloudError;
      }
      return false;
    }
  }
}

/**
 * Get current configuration
 */
function getConfig() {
  if (!configCache) {
    loadConfig();
  }
  return { ...configCache };
}

/**
 * Update configuration (ROOT only - validation done in middleware)
 */
function updateConfig(updates, userId = null) {
  const currentConfig = getConfig();
  
  // Deep merge for nested objects
  let newConfig = {
    ...currentConfig,
    ...updates,
    lastUpdated: new Date().toISOString(),
    updatedBy: userId
  };
  
  // Handle nested database updates
  if (updates.database) {
    newConfig.database = {
      ...currentConfig.database,
      ...updates.database
    };
  }
  
  // Handle nested limits updates
  if (updates.limits) {
    newConfig.limits = {
      ...currentConfig.limits,
      ...updates.limits
    };
    // Remove deprecated field if present
    delete newConfig.limits.maxUsersPerAdmin;
  }
  
  // Validate backendMode
  if (newConfig.backendMode && !['LOCAL', 'LIVE', 'OFFLINE', 'DUMMY_DATA'].includes(newConfig.backendMode)) {
    throw new Error('Invalid backendMode. Must be LOCAL, LIVE, OFFLINE, or DUMMY_DATA');
  }
  
  // Validate limits (only check existing fields)
  if (newConfig.limits) {
    if (newConfig.limits.maxAdmins !== undefined && 
        (typeof newConfig.limits.maxAdmins !== 'number' || newConfig.limits.maxAdmins < 1)) {
      throw new Error('maxAdmins must be a positive number');
    }
    if (newConfig.limits.maxTotalUsers !== undefined && 
        (typeof newConfig.limits.maxTotalUsers !== 'number' || newConfig.limits.maxTotalUsers < 1)) {
      throw new Error('maxTotalUsers must be a positive number');
    }
  }
  
  // Validate serviceEnabled
  if (newConfig.serviceEnabled !== undefined && typeof newConfig.serviceEnabled !== 'boolean') {
    newConfig.serviceEnabled = Boolean(newConfig.serviceEnabled);
  }
  
  if (saveConfig(newConfig)) {
    return newConfig;
  }
  throw new Error('Failed to save configuration');
}

/**
 * Get the effective Tally URL based on backend mode
 */
function getTallyUrl() {
  const config = getConfig();
  
  switch (config.backendMode) {
    case 'LIVE':
      return config.liveServerUrl || config.tallyUrl;
    case 'LOCAL':
      return config.tallyUrl;
    case 'DUMMY_DATA':
      return null; // No Tally URL in dummy mode
    default:
      return config.tallyUrl;
  }
}

/**
 * Check if backend is in dummy data mode
 */
function isDummyMode() {
  const config = getConfig();
  return config.backendMode === 'DUMMY_DATA';
}

/**
 * Check if backend is in offline mode (no Tally connection)
 */
function isOfflineMode() {
  const config = getConfig();
  return config.backendMode === 'OFFLINE' || config.backendMode === 'DUMMY_DATA';
}

/**
 * Check if service is enabled
 */
function isServiceEnabled() {
  const config = getConfig();
  return config.serviceEnabled !== false;
}

/**
 * Get backend mode
 */
function getBackendMode() {
  const config = getConfig();
  return config.backendMode;
}

/**
 * Get creation limits
 */
function getLimits() {
  const config = getConfig();
  return { ...config.limits };
}

/**
 * Reset configuration to defaults
 */
function resetConfig(userId = null) {
  const newConfig = {
    ...DEFAULT_CONFIG,
    lastUpdated: new Date().toISOString(),
    updatedBy: userId
  };
  
  if (saveConfig(newConfig)) {
    return newConfig;
  }
  throw new Error('Failed to reset configuration');
}

// Initialize config on module load
loadConfig();

module.exports = {
  getConfig,
  updateConfig,
  getTallyUrl,
  isDummyMode,
  isOfflineMode,
  isServiceEnabled,
  getBackendMode,
  getLimits,
  resetConfig,
  DEFAULT_CONFIG
};

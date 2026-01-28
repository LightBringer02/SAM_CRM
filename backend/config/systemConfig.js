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
 * Load configuration from file
 * Auto-creates default config if none exists - never throws error
 */
function loadConfig() {
  try {
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
      // Remove deprecated fields
      if (configCache.limits.maxUsersPerAdmin !== undefined) {
        delete configCache.limits.maxUsersPerAdmin;
      }
      // Ensure serviceEnabled exists
      if (configCache.serviceEnabled === undefined) {
        configCache.serviceEnabled = true;
      }
    } else {
      // Create default config file silently
      configCache = { ...DEFAULT_CONFIG };
      saveConfig(configCache);
    }
  } catch (err) {
    console.warn('Config load warning (using defaults):', err.message);
    configCache = { ...DEFAULT_CONFIG };
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
 */
function saveConfig(config) {
  try {
    // Ensure directory exists
    const dir = path.dirname(CONFIG_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), 'utf8');
    configCache = config;
    return true;
  } catch (err) {
    console.error('Error saving system config:', err);
    return false;
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

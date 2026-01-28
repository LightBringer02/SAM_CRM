/**
 * Database Routes Index
 * Combines all database-related routes
 */


const queueRoutes = require('./queue');
const backupRoutes = require('./backup');
const fetchRoutes = require('./fetch');
const databaseRoutes = require('./database');

module.exports = {
  queueRoutes,
  backupRoutes,
  fetchRoutes,
  databaseRoutes
};

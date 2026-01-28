/**
 * Database Migration Runner
 * Handles schema migrations for the CRM database
 */

const fs = require('fs');
const path = require('path');
const { query, transaction } = require('../sql/connection');

// Migrations directory
const MIGRATIONS_DIR = __dirname;

/**
 * Ensure migrations table exists
 */
async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations() {
  await ensureMigrationsTable();
  const result = await query('SELECT name FROM migrations ORDER BY id');
  return result.rows.map(r => r.name);
}

/**
 * Get list of pending migrations
 */
async function getPendingMigrations() {
  const applied = await getAppliedMigrations();
  
  // Get all SQL files in migrations directory
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  return files.filter(f => !applied.includes(f));
}

/**
 * Run a single migration
 * @param {string} migrationFile - Migration filename
 */
async function runMigration(migrationFile) {
  const filePath = path.join(MIGRATIONS_DIR, migrationFile);
  const sql = fs.readFileSync(filePath, 'utf8');

  console.log(`[Migrations] Running: ${migrationFile}`);

  await transaction(async (client) => {
    // Run migration SQL
    await client.query(sql);
    
    // Record migration
    await client.query(
      'INSERT INTO migrations (name) VALUES ($1)',
      [migrationFile]
    );
  });

  console.log(`[Migrations] Completed: ${migrationFile}`);
}

/**
 * Run all pending migrations
 */
async function runAllMigrations() {
  const pending = await getPendingMigrations();

  if (pending.length === 0) {
    console.log('[Migrations] No pending migrations');
    return { applied: [], count: 0 };
  }

  console.log(`[Migrations] Running ${pending.length} pending migration(s)`);

  const applied = [];
  for (const migration of pending) {
    await runMigration(migration);
    applied.push(migration);
  }

  return { applied, count: applied.length };
}

/**
 * Run initial database setup from init.sql
 */
async function runInitialSetup() {
  const initPath = path.join(__dirname, '..', 'sql', 'init.sql');
  
  if (!fs.existsSync(initPath)) {
    throw new Error('init.sql not found');
  }

  console.log('[Migrations] Running initial database setup');
  
  const sql = fs.readFileSync(initPath, 'utf8');
  
  // Split by semicolons and run each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    try {
      await query(statement);
    } catch (err) {
      // Ignore "already exists" errors
      if (!err.message.includes('already exists')) {
        console.warn(`[Migrations] Statement warning: ${err.message}`);
      }
    }
  }

  console.log('[Migrations] Initial setup completed');
}

/**
 * Get migration status
 */
async function getStatus() {
  const applied = await getAppliedMigrations();
  const pending = await getPendingMigrations();

  return {
    applied: applied.length,
    pending: pending.length,
    appliedMigrations: applied,
    pendingMigrations: pending
  };
}

/**
 * Rollback last migration (if supported)
 * Note: Requires down.sql files for each migration
 */
async function rollbackLast() {
  const applied = await getAppliedMigrations();
  
  if (applied.length === 0) {
    return { rolledBack: null, message: 'No migrations to rollback' };
  }

  const lastMigration = applied[applied.length - 1];
  const downFile = lastMigration.replace('.sql', '.down.sql');
  const downPath = path.join(MIGRATIONS_DIR, downFile);

  if (!fs.existsSync(downPath)) {
    throw new Error(`No rollback file found: ${downFile}`);
  }

  console.log(`[Migrations] Rolling back: ${lastMigration}`);

  const sql = fs.readFileSync(downPath, 'utf8');

  await transaction(async (client) => {
    await client.query(sql);
    await client.query('DELETE FROM migrations WHERE name = $1', [lastMigration]);
  });

  console.log(`[Migrations] Rolled back: ${lastMigration}`);
  
  return { rolledBack: lastMigration };
}

module.exports = {
  runAllMigrations,
  runMigration,
  runInitialSetup,
  getAppliedMigrations,
  getPendingMigrations,
  getStatus,
  rollbackLast,
  ensureMigrationsTable
};

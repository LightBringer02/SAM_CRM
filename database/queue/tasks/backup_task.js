/**
 * Backup Task
 * Handles database backup and restore operations
 * Stores backups as JSONB in PostgreSQL
 */

const { query, transaction, getClient } = require('../../sql/connection');
const { insert, select } = require('../../sql/sql_utils');
const { v4: uuidv4 } = require('uuid');

// Tables to backup
const BACKUP_TABLES = [
  'inventory_items',
  'vouchers', 
  'ledgers',
  'sync_history',
  'system_config'
];

/**
 * Create a backup snapshot
 * @param {Object} options - { name, description, backupType, createdBy, tables }
 */
async function createSnapshot(options = {}) {
  const {
    name = `Backup ${new Date().toISOString()}`,
    description = '',
    backupType = 'full',
    createdBy = 'system',
    tables = BACKUP_TABLES
  } = options;

  console.log(`[BackupTask] Creating snapshot: ${name}`);

  // Create snapshot record
  // Use PostgreSQL array literal format instead of JSON
  const snapshot = await insert('backup_snapshots', {
    name,
    description,
    backup_type: backupType,
    status: 'in_progress',
    tables_included: `{${tables.join(',')}}`,
    created_by: createdBy
  });

  return snapshot;
}

/**
 * Backup a single table
 * @param {string} snapshotId - Snapshot ID
 * @param {string} tableName - Table to backup
 */
async function backupTable(snapshotId, tableName) {
  console.log(`[BackupTask] Backing up table: ${tableName}`);

  // Get all rows from table
  const result = await query(`SELECT * FROM ${tableName}`);
  const rows = result.rows;

  if (rows.length === 0) {
    console.log(`[BackupTask] Table ${tableName} is empty, skipping`);
    return { table: tableName, rowCount: 0 };
  }

  // Store as JSONB in backup_data
  await insert('backup_data', {
    snapshot_id: snapshotId,
    table_name: tableName,
    row_data: JSON.stringify(rows),
    row_count: rows.length
  });

  console.log(`[BackupTask] Backed up ${rows.length} rows from ${tableName}`);

  return { table: tableName, rowCount: rows.length };
}

/**
 * Execute backup operation
 * @param {Object} payload - Backup options
 */
async function executeBackup(payload = {}) {
  const startTime = Date.now();
  const { 
    backupType = 'full',
    description = 'Manual backup',
    createdBy = 'system'
  } = payload;

  console.log(`[BackupTask] Starting ${backupType} backup`);

  let snapshot;
  const results = {
    tables: [],
    totalRows: 0,
    sizeEstimate: 0,
    duration: 0
  };

  try {
    // Create snapshot record
    snapshot = await createSnapshot({
      name: `${backupType.charAt(0).toUpperCase() + backupType.slice(1)} Backup - ${new Date().toLocaleDateString()}`,
      description,
      backupType,
      createdBy
    });

    // Backup each table
    for (const tableName of BACKUP_TABLES) {
      try {
        const tableResult = await backupTable(snapshot.id, tableName);
        results.tables.push(tableResult);
        results.totalRows += tableResult.rowCount;
      } catch (tableErr) {
        console.error(`[BackupTask] Error backing up ${tableName}:`, tableErr.message);
        results.tables.push({ table: tableName, error: tableErr.message });
      }
    }

    // Calculate approximate size
    const sizeResult = await query(`
      SELECT SUM(pg_column_size(row_data)) as size 
      FROM backup_data 
      WHERE snapshot_id = $1
    `, [snapshot.id]);
    
    results.sizeEstimate = parseInt(sizeResult.rows[0]?.size || 0);

    // Update snapshot as completed
    await query(`
      UPDATE backup_snapshots 
      SET status = 'completed', 
          completed_at = NOW(),
          size_bytes = $1
      WHERE id = $2
    `, [results.sizeEstimate, snapshot.id]);

    results.snapshotId = snapshot.id;
    results.duration = Date.now() - startTime;

    console.log(`[BackupTask] Backup completed: ${results.totalRows} rows in ${results.duration}ms`);

  } catch (err) {
    console.error('[BackupTask] Backup failed:', err.message);
    
    if (snapshot) {
      await query(`
        UPDATE backup_snapshots 
        SET status = 'failed', completed_at = NOW()
        WHERE id = $1
      `, [snapshot.id]);
    }

    throw err;
  }

  return results;
}

/**
 * Restore from a backup snapshot
 * @param {Object} payload - { snapshotId }
 */
async function executeRestore(payload = {}) {
  const { snapshotId } = payload;

  if (!snapshotId) {
    throw new Error('Snapshot ID is required for restore');
  }

  console.log(`[BackupTask] Starting restore from snapshot: ${snapshotId}`);

  const startTime = Date.now();
  const results = {
    tables: [],
    totalRows: 0,
    duration: 0
  };

  // Get snapshot info
  const snapshotResult = await query(
    'SELECT * FROM backup_snapshots WHERE id = $1',
    [snapshotId]
  );

  if (snapshotResult.rows.length === 0) {
    throw new Error(`Snapshot ${snapshotId} not found`);
  }

  const snapshot = snapshotResult.rows[0];

  if (snapshot.status !== 'completed') {
    throw new Error(`Cannot restore from snapshot with status: ${snapshot.status}`);
  }

  // Get backup data
  const backupDataResult = await query(
    'SELECT * FROM backup_data WHERE snapshot_id = $1',
    [snapshotId]
  );

  // Restore each table in a transaction
  await transaction(async (client) => {
    for (const backupEntry of backupDataResult.rows) {
      const { table_name, row_data, row_count } = backupEntry;
      const rows = typeof row_data === 'string' ? JSON.parse(row_data) : row_data;

      console.log(`[BackupTask] Restoring ${row_count} rows to ${table_name}`);

      // Truncate existing data
      await client.query(`TRUNCATE TABLE ${table_name} CASCADE`);

      // Insert restored data
      if (rows.length > 0) {
        const columns = Object.keys(rows[0]).filter(c => c !== 'id');
        
        for (const row of rows) {
          const values = columns.map(c => row[c]);
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
          
          await client.query(
            `INSERT INTO ${table_name} (${columns.join(', ')}) VALUES (${placeholders})`,
            values
          );
        }
      }

      results.tables.push({ table: table_name, rowCount: row_count });
      results.totalRows += row_count;
    }
  });

  results.snapshotId = snapshotId;
  results.duration = Date.now() - startTime;

  console.log(`[BackupTask] Restore completed: ${results.totalRows} rows in ${results.duration}ms`);

  return results;
}

/**
 * List available backups
 * @param {Object} filters - { limit, status }
 */
async function listSnapshots(filters = {}) {
  const { limit = 20, status } = filters;

  let sql = 'SELECT * FROM backup_snapshots WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (status) {
    sql += ` AND status = $${paramIndex++}`;
    params.push(status);
  }

  sql += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
  params.push(limit);

  const result = await query(sql, params);
  return result.rows;
}

/**
 * Get snapshot details
 * @param {string} snapshotId - Snapshot ID
 */
async function getSnapshotDetails(snapshotId) {
  const snapshotResult = await query(
    'SELECT * FROM backup_snapshots WHERE id = $1',
    [snapshotId]
  );

  if (snapshotResult.rows.length === 0) {
    return null;
  }

  const snapshot = snapshotResult.rows[0];

  // Get backup data summary
  const dataResult = await query(`
    SELECT table_name, row_count 
    FROM backup_data 
    WHERE snapshot_id = $1
  `, [snapshotId]);

  snapshot.tables = dataResult.rows;

  return snapshot;
}

/**
 * Get snapshot data for download
 * @param {string} snapshotId - Snapshot ID
 */
async function getSnapshotData(snapshotId) {
  console.log(`[BackupTask] Getting snapshot data for download: ${snapshotId}`);

  const dataResult = await query(`
    SELECT table_name, row_data, row_count 
    FROM backup_data 
    WHERE snapshot_id = $1
  `, [snapshotId]);

  // Parse row_data JSON strings back to objects
  const data = {};
  for (const row of dataResult.rows) {
    try {
      data[row.table_name] = typeof row.row_data === 'string' 
        ? JSON.parse(row.row_data) 
        : row.row_data;
    } catch (e) {
      data[row.table_name] = row.row_data;
    }
  }

  return data;
}

/**
 * Delete a backup snapshot
 * @param {string} snapshotId - Snapshot ID
 */
async function deleteSnapshot(snapshotId) {
  console.log(`[BackupTask] Deleting snapshot: ${snapshotId}`);

  // backup_data will be deleted via CASCADE
  await query('DELETE FROM backup_snapshots WHERE id = $1', [snapshotId]);

  return { deleted: true, snapshotId };
}

/**
 * Cleanup old backups based on retention policy
 * @param {number} retentionDays - Days to keep backups
 */
async function cleanupOldBackups(retentionDays = 30) {
  const result = await query('SELECT cleanup_old_backups($1)', [retentionDays]);
  return { cleaned: result.rows[0].cleanup_old_backups };
}

module.exports = {
  executeBackup,
  executeRestore,
  listSnapshots,
  getSnapshotDetails,
  getSnapshotData,
  deleteSnapshot,
  cleanupOldBackups,
  BACKUP_TABLES
};

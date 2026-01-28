/**
 * SQL Utilities
 * Helper functions for common database operations
 */

const { query, transaction } = require('./connection');

/**
 * Insert a single row into a table
 * @param {string} table - Table name
 * @param {Object} data - Column-value pairs
 * @returns {Promise<Object>} Inserted row
 */
async function insert(table, data) {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  
  const sql = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${placeholders})
    RETURNING *
  `;
  
  const result = await query(sql, values);
  return result.rows[0];
}

/**
 * Bulk insert multiple rows
 * @param {string} table - Table name
 * @param {Array<Object>} rows - Array of row objects
 * @returns {Promise<number>} Number of inserted rows
 */
async function bulkInsert(table, rows) {
  if (!rows || rows.length === 0) return 0;
  
  const columns = Object.keys(rows[0]);
  let insertedCount = 0;
  
  await transaction(async (client) => {
    for (const row of rows) {
      const values = columns.map(col => row[col]);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      
      await client.query(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
        values
      );
      insertedCount++;
    }
  });
  
  return insertedCount;
}

/**
 * Upsert (insert or update) a row
 * @param {string} table - Table name
 * @param {Object} data - Column-value pairs
 * @param {string|Array} conflictColumns - Column(s) to check for conflict
 * @param {Array} updateColumns - Columns to update on conflict (optional, defaults to all)
 * @returns {Promise<Object>} Upserted row
 */
async function upsert(table, data, conflictColumns, updateColumns = null) {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  
  const conflict = Array.isArray(conflictColumns) 
    ? conflictColumns.join(', ') 
    : conflictColumns;
  
  const updates = (updateColumns || columns.filter(c => !conflictColumns.includes(c)))
    .map(col => `${col} = EXCLUDED.${col}`)
    .join(', ');
  
  const sql = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT (${conflict}) DO UPDATE SET ${updates}
    RETURNING *
  `;
  
  const result = await query(sql, values);
  return result.rows[0];
}

/**
 * Bulk upsert multiple rows
 * @param {string} table - Table name
 * @param {Array<Object>} rows - Array of row objects
 * @param {string|Array} conflictColumns - Column(s) to check for conflict
 * @returns {Promise<number>} Number of upserted rows
 */
async function bulkUpsert(table, rows, conflictColumns) {
  if (!rows || rows.length === 0) return 0;
  
  let upsertedCount = 0;
  
  await transaction(async (client) => {
    for (const row of rows) {
      const columns = Object.keys(row);
      const values = Object.values(row);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      
      const conflict = Array.isArray(conflictColumns) 
        ? conflictColumns.join(', ') 
        : conflictColumns;
      
      const updates = columns
        .filter(c => !conflictColumns.includes(c))
        .map(col => `${col} = EXCLUDED.${col}`)
        .join(', ');
      
      await client.query(
        `INSERT INTO ${table} (${columns.join(', ')}) 
         VALUES (${placeholders}) 
         ON CONFLICT (${conflict}) DO UPDATE SET ${updates}`,
        values
      );
      upsertedCount++;
    }
  });
  
  return upsertedCount;
}

/**
 * Select rows from a table
 * @param {string} table - Table name
 * @param {Object} where - WHERE conditions (AND)
 * @param {Object} options - { orderBy, limit, offset, columns }
 * @returns {Promise<Array>} Selected rows
 */
async function select(table, where = {}, options = {}) {
  const columns = options.columns || '*';
  const conditions = Object.keys(where);
  const values = Object.values(where);
  
  let sql = `SELECT ${columns} FROM ${table}`;
  
  if (conditions.length > 0) {
    const whereClause = conditions.map((col, i) => `${col} = $${i + 1}`).join(' AND ');
    sql += ` WHERE ${whereClause}`;
  }
  
  if (options.orderBy) {
    sql += ` ORDER BY ${options.orderBy}`;
  }
  
  if (options.limit) {
    sql += ` LIMIT ${options.limit}`;
  }
  
  if (options.offset) {
    sql += ` OFFSET ${options.offset}`;
  }
  
  const result = await query(sql, values);
  return result.rows;
}

/**
 * Update rows in a table
 * @param {string} table - Table name
 * @param {Object} data - Column-value pairs to update
 * @param {Object} where - WHERE conditions
 * @returns {Promise<number>} Number of updated rows
 */
async function update(table, data, where) {
  const dataColumns = Object.keys(data);
  const dataValues = Object.values(data);
  const whereColumns = Object.keys(where);
  const whereValues = Object.values(where);
  
  const setClause = dataColumns.map((col, i) => `${col} = $${i + 1}`).join(', ');
  const whereClause = whereColumns.map((col, i) => `${col} = $${dataColumns.length + i + 1}`).join(' AND ');
  
  const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
  
  const result = await query(sql, [...dataValues, ...whereValues]);
  return result.rowCount;
}

/**
 * Delete rows from a table
 * @param {string} table - Table name
 * @param {Object} where - WHERE conditions
 * @returns {Promise<number>} Number of deleted rows
 */
async function remove(table, where) {
  const conditions = Object.keys(where);
  const values = Object.values(where);
  
  const whereClause = conditions.map((col, i) => `${col} = $${i + 1}`).join(' AND ');
  const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
  
  const result = await query(sql, values);
  return result.rowCount;
}

/**
 * Count rows in a table
 * @param {string} table - Table name
 * @param {Object} where - WHERE conditions
 * @returns {Promise<number>} Row count
 */
async function count(table, where = {}) {
  const conditions = Object.keys(where);
  const values = Object.values(where);
  
  let sql = `SELECT COUNT(*) as count FROM ${table}`;
  
  if (conditions.length > 0) {
    const whereClause = conditions.map((col, i) => `${col} = $${i + 1}`).join(' AND ');
    sql += ` WHERE ${whereClause}`;
  }
  
  const result = await query(sql, values);
  return parseInt(result.rows[0].count, 10);
}

/**
 * Check if a table exists
 * @param {string} table - Table name
 * @returns {Promise<boolean>}
 */
async function tableExists(table) {
  const sql = `
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    )
  `;
  const result = await query(sql, [table]);
  return result.rows[0].exists;
}

/**
 * Truncate a table
 * @param {string} table - Table name
 * @param {boolean} cascade - Whether to cascade
 */
async function truncate(table, cascade = false) {
  const sql = `TRUNCATE TABLE ${table}${cascade ? ' CASCADE' : ''}`;
  await query(sql);
}

module.exports = {
  insert,
  bulkInsert,
  upsert,
  bulkUpsert,
  select,
  update,
  remove,
  count,
  tableExists,
  truncate
};

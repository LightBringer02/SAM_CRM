/**
 * Script to check and display ledger parent groups in database
 * Run: node check_db_ledgers.js
 */

const { Pool } = require('pg');

// Database connection from database/sql/connection.js pattern
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'crm_database',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

const normalizeGroupName = (name = '') =>
  name
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

async function checkLedgers() {
  try {
    console.log('Connecting to database...');
    
    // Get all ledgers with their parent groups
    const result = await pool.query(`
      SELECT name, parent, 
             opening_balance, closing_balance,
             balance_type, is_debit, is_credit
      FROM tally_ledgers 
      WHERE parent ILIKE '%expense%' OR parent ILIKE '%income%'
      ORDER BY parent, name
    `);
    
    console.log('\n' + '='.repeat(80));
    console.log(`Found ${result.rows.length} ledgers with Expense/Income parent groups:`);
    console.log('='.repeat(80));
    
    const byParent = {};
    for (const row of result.rows) {
      const parent = row.parent || 'Unknown';
      if (!byParent[parent]) byParent[parent] = [];
      byParent[parent].push(row);
    }
    
    for (const [parent, ledgers] of Object.entries(byParent).sort()) {
      console.log(`\n${parent} (${ledgers.length} ledgers):`);
      console.log(`  Normalized: "${normalizeGroupName(parent)}"`);
      ledgers.forEach(l => {
        console.log(`  • ${l.name} - Balance: ${l.closing_balance} ${l.balance_type}`);
      });
    }
    
    // Check for potential duplicates
    console.log('\n' + '='.repeat(80));
    console.log('DUPLICATE CHECK:');
    console.log('='.repeat(80));
    
    const nameCount = await pool.query(`
      SELECT name, COUNT(*) as count, array_agg(DISTINCT parent) as parents
      FROM tally_ledgers
      GROUP BY name
      HAVING COUNT(*) > 1
    `);
    
    if (nameCount.rows.length > 0) {
      console.log(`Found ${nameCount.rows.length} duplicate ledger names:`);
      nameCount.rows.forEach(row => {
        console.log(`  • ${row.name} appears ${row.count} times in groups: ${row.parents.join(', ')}`);
      });
    } else {
      console.log('✓ No duplicate ledger names found');
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkLedgers();

const db = require('./sql/connection');

async function checkLedgers() {
  try {
    const result = await db.query(`
      SELECT name, parent 
      FROM tally_ledgers 
      WHERE parent ILIKE '%expense%' OR parent ILIKE '%income%'
      ORDER BY parent, name
    `);
    
    console.log('\n=== EXPENSE/INCOME LEDGERS IN DATABASE ===\n');
    
    const groups = {};
    result.rows.forEach(l => {
      const parent = l.parent || 'Unknown';
      if (!groups[parent]) groups[parent] = [];
      groups[parent].push(l.name);
    });
    
    Object.keys(groups).sort().forEach(parent => {
      console.log(`${parent} (${groups[parent].length}):`);
      groups[parent].forEach(name => console.log(`  • ${name}`));
      console.log('');
    });
    
    // Check for duplicates
    const dupes = await db.query(`
      SELECT name, COUNT(*) as count, array_agg(parent) as parents
      FROM tally_ledgers
      GROUP BY name
      HAVING COUNT(*) > 1
    `);
    
    if (dupes.rows.length > 0) {
      console.log('=== DUPLICATE LEDGER NAMES ===\n');
      dupes.rows.forEach(d => {
        console.log(`${d.name}: appears ${d.count} times in ${d.parents.join(', ')}`);
      });
    } else {
      console.log('✓ No duplicate ledger names\n');
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await db.pool.end();
  }
}

checkLedgers();

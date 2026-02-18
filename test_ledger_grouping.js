/**
 * Test script to verify ledger grouping logic
 * Run: node test_ledger_grouping.js
 */

const normalizeGroupName = (name = '') =>
  name
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// Group definitions from backend/routes/ledgers.js
const LEDGER_GROUPS = {
  'direct-expenses': ['Direct Expenses', 'Direct Expense', 'Expenses (Direct)', 'Expense (Direct)'],
  'indirect-expenses': ['Indirect Expenses', 'Indirect Expense', 'Expenses (Indirect)', 'Expense (Indirect)'],
  'direct-incomes': ['Direct Incomes', 'Direct Income', 'Income (Direct)'],
  'indirect-incomes': ['Indirect Incomes', 'Indirect Income', 'Income (Indirect)'],
};

// Test ledgers from daybook.xml
const testLedgers = [
  { name: 'Incentive', parent: 'Indirect Expenses' },
  { name: 'Scrap', parent: 'Direct Incomes' },
  { name: 'PURCHASE', parent: 'Purchase Accounts' },
  { name: 'SALES', parent: 'Sales Accounts' },
];

console.log('='.repeat(60));
console.log('LEDGER GROUPING TEST');
console.log('='.repeat(60));

// Test each ledger against each group
for (const ledger of testLedgers) {
  console.log(`\n${ledger.name} (parent: "${ledger.parent}")`);
  const parentNorm = normalizeGroupName(ledger.parent);
  console.log(`  Normalized parent: "${parentNorm}"`);
  
  for (const [groupKey, groupNames] of Object.entries(LEDGER_GROUPS)) {
    const normalizedTargets = groupNames.map(g => normalizeGroupName(g));
    const matches = normalizedTargets.includes(parentNorm);
    
    if (matches) {
      console.log(`  ✓ MATCHES ${groupKey}`);
      console.log(`    Matched against: ${normalizedTargets.join(', ')}`);
    }
  }
}

console.log('\n' + '='.repeat(60));
console.log('CROSS-CONTAMINATION TEST');
console.log('='.repeat(60));

// Verify no cross-contamination between direct/indirect
const directExpenseTargets = LEDGER_GROUPS['direct-expenses'].map(normalizeGroupName);
const indirectExpenseTargets = LEDGER_GROUPS['indirect-expenses'].map(normalizeGroupName);
const directIncomeTargets = LEDGER_GROUPS['direct-incomes'].map(normalizeGroupName);
const indirectIncomeTargets = LEDGER_GROUPS['indirect-incomes'].map(normalizeGroupName);

console.log('\nDirect Expenses targets:', directExpenseTargets);
console.log('Indirect Expenses targets:', indirectExpenseTargets);
console.log('Direct Incomes targets:', directIncomeTargets);
console.log('Indirect Incomes targets:', indirectIncomeTargets);

// Check for overlaps
const overlap1 = directExpenseTargets.filter(t => indirectExpenseTargets.includes(t));
const overlap2 = directIncomeTargets.filter(t => indirectIncomeTargets.includes(t));

if (overlap1.length > 0) {
  console.log('\n❌ ERROR: Direct/Indirect Expenses overlap:', overlap1);
} else {
  console.log('\n✓ No overlap between Direct and Indirect Expenses');
}

if (overlap2.length > 0) {
  console.log('❌ ERROR: Direct/Indirect Incomes overlap:', overlap2);
} else {
  console.log('✓ No overlap between Direct and Indirect Incomes');
}

console.log('\n' + '='.repeat(60));
console.log('EXPECTED RESULTS:');
console.log('='.repeat(60));
console.log('• Incentive should ONLY match indirect-expenses');
console.log('• Scrap should ONLY match direct-incomes');
console.log('• No ledger should match both direct and indirect groups');
console.log('='.repeat(60));

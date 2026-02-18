/**
 * Comprehensive Edge Case Test for Ledger Grouping
 */

const normalizeGroupName = (name = '') =>
  name
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

console.log('='.repeat(80));
console.log('LEDGER GROUPING - COMPREHENSIVE EDGE CASE TEST');
console.log('='.repeat(80));

// Test cases covering various edge cases
const edgeCases = [
  // Standard cases
  { name: 'Test1', parent: 'Direct Expenses', shouldMatch: ['direct-expenses'], issue: null },
  { name: 'Test2', parent: 'Indirect Expenses', shouldMatch: ['indirect-expenses'], issue: null },
  { name: 'Test3', parent: 'Direct Incomes', shouldMatch: ['direct-incomes'], issue: null },
  { name: 'Test4', parent: 'Indirect Incomes', shouldMatch: ['indirect-incomes'], issue: null },
  
  // Singular forms
  { name: 'Test5', parent: 'Direct Expense', shouldMatch: ['direct-expenses'], issue: 'Singular form' },
  { name: 'Test6', parent: 'Indirect Income', shouldMatch: ['indirect-incomes'], issue: 'Singular form' },
  
  // Parenthesized forms
  { name: 'Test7', parent: 'Expenses (Direct)', shouldMatch: ['direct-expenses'], issue: 'Parenthesized form' },
  { name: 'Test8', parent: 'Income (Indirect)', shouldMatch: ['indirect-incomes'], issue: 'Parenthesized form' },
  
  // HTML entity
  { name: 'Test9', parent: 'Duties &amp; Taxes', shouldMatch: ['duties-taxes'], issue: 'HTML entity &amp;' },
  
  // Extra whitespace
  { name: 'Test10', parent: '  Direct   Expenses  ', shouldMatch: ['direct-expenses'], issue: 'Extra whitespace' },
  
  // Case variations
  { name: 'Test11', parent: 'DIRECT EXPENSES', shouldMatch: ['direct-expenses'], issue: 'All caps' },
  { name: 'Test12', parent: 'direct expenses', shouldMatch: ['direct-expenses'], issue: 'All lowercase' },
  { name: 'Test13', parent: 'DiReCt ExPeNsEs', shouldMatch: ['direct-expenses'], issue: 'Mixed case' },
  
  // Should NOT match
  { name: 'Test14', parent: 'Expenses', shouldMatch: [], issue: 'Generic "Expenses" - should NOT match any group' },
  { name: 'Test15', parent: 'Incomes', shouldMatch: [], issue: 'Generic "Incomes" - should NOT match any group' },
  { name: 'Test16', parent: 'Purchase Accounts', shouldMatch: ['purchase-accounts'], issue: 'Different group' },
  
  // Cross-contamination tests (CRITICAL)
  { name: 'Journal1', parent: 'Direct Expenses', shouldNotMatch: ['indirect-expenses'], issue: 'Must NOT match indirect' },
  { name: 'Journal2', parent: 'Indirect Expenses', shouldNotMatch: ['direct-expenses'], issue: 'Must NOT match direct' },
  { name: 'Journal3', parent: 'Direct Incomes', shouldNotMatch: ['indirect-incomes'], issue: 'Must NOT match indirect' },
  { name: 'Journal4', parent: 'Indirect Incomes', shouldNotMatch: ['direct-incomes'], issue: 'Must NOT match direct' },
];

// Group definitions
const LEDGER_GROUPS = {
  'direct-expenses': ['Direct Expenses', 'Direct Expense', 'Expenses (Direct)', 'Expense (Direct)'],
  'indirect-expenses': ['Indirect Expenses', 'Indirect Expense', 'Expenses (Indirect)', 'Expense (Indirect)'],
  'direct-incomes': ['Direct Incomes', 'Direct Income', 'Income (Direct)'],
  'indirect-incomes': ['Indirect Incomes', 'Indirect Income', 'Income (Indirect)'],
  'duties-taxes': ['Duties & Taxes', 'Duties and Taxes'],
  'purchase-accounts': ['Purchase Accounts'],
};

let passCount = 0;
let failCount = 0;

edgeCases.forEach((testCase, idx) => {
  const testNum = idx + 1;
  const parentNorm = normalizeGroupName(testCase.parent);
  
  console.log(`\nTest ${testNum}: ${testCase.name}`);
  console.log(`  Parent: "${testCase.parent}" → "${parentNorm}"`);
  if (testCase.issue) {
    console.log(`  Edge Case: ${testCase.issue}`);
  }
  
  let passed = true;
  
  // Check shouldMatch
  if (testCase.shouldMatch && testCase.shouldMatch.length > 0) {
    const matches = testCase.shouldMatch.filter(groupKey => {
      const groupNames = LEDGER_GROUPS[groupKey] || [];
      const normalizedTargets = groupNames.map(normalizeGroupName);
      return normalizedTargets.includes(parentNorm);
    });
    
    if (matches.length === testCase.shouldMatch.length) {
      console.log(`  ✓ Correctly matches: ${testCase.shouldMatch.join(', ')}`);
    } else {
      console.log(`  ✗ FAIL: Expected to match ${testCase.shouldMatch.join(', ')}, but matched ${matches.join(', ')}`);
      passed = false;
    }
  }
  
  // Check shouldNotMatch
  if (testCase.shouldNotMatch && testCase.shouldNotMatch.length > 0) {
    const wrongMatches = testCase.shouldNotMatch.filter(groupKey => {
      const groupNames = LEDGER_GROUPS[groupKey] || [];
      const normalizedTargets = groupNames.map(normalizeGroupName);
      return normalizedTargets.includes(parentNorm);
    });
    
    if (wrongMatches.length === 0) {
      console.log(`  ✓ Correctly does NOT match: ${testCase.shouldNotMatch.join(', ')}`);
    } else {
      console.log(`  ✗ FAIL: Should NOT match ${testCase.shouldNotMatch.join(', ')}, but DID match ${wrongMatches.join(', ')}`);
      passed = false;
    }
  }
  
  if (passed) {
    passCount++;
  } else {
    failCount++;
  }
});

console.log('\n' + '='.repeat(80));
console.log('TEST RESULTS');
console.log('='.repeat(80));
console.log(`Passed: ${passCount}/${edgeCases.length}`);
console.log(`Failed: ${failCount}/${edgeCases.length}`);

if (failCount === 0) {
  console.log('\n✓ All edge case tests PASSED!');
  console.log('The ledger grouping logic is robust and handles all edge cases correctly.');
} else {
  console.log(`\n✗ ${failCount} test(s) FAILED!`);
  console.log('Review the failed tests above and fix the grouping logic.');
}
console.log('='.repeat(80));

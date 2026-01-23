// test.js - Test file to verify Tally connection and operations
require('dotenv').config();
const TallyConnector = require('./tally-connector');

const tally = new TallyConnector({
  host: process.env.TALLY_HOST || 'localhost',
  port: process.env.TALLY_PORT || 9000,
  company: process.env.TALLY_COMPANY || ''
});

// Test functions
async function testConnection() {
  console.log('Testing Tally connection...');
  try {
    const result = await tally.getCompanyInfo();
    console.log('✓ Connection successful!');
    console.log('Company info:', result);
    return true;
  } catch (error) {
    console.error('✗ Connection failed:', error.message);
    return false;
  }
}

async function testCreateLedger() {
  console.log('\nTesting ledger creation...');
  try {
    const result = await tally.createLedger({
      name: 'Test Customer ' + Date.now(),
      parent: 'Sundry Debtors',
      openingBalance: 0,
      email: 'test@example.com',
      mobile: '9999999999',
      address: 'Test Address',
      gstin: '',
      state: 'Karnataka',
      pincode: '560001'
    });
    console.log('✓ Ledger created successfully!');
    return true;
  } catch (error) {
    console.error('✗ Ledger creation failed:', error.message);
    return false;
  }
}

async function testGetAllLedgers() {
  console.log('\nTesting get all ledgers...');
  try {
    const result = await tally.getAllLedgers();
    console.log('✓ Ledgers retrieved successfully!');
    return true;
  } catch (error) {
    console.error('✗ Get ledgers failed:', error.message);
    return false;
  }
}

async function testCreateStockItem() {
  console.log('\nTesting stock item creation...');
  try {
    const result = await tally.createStockItem({
      name: 'Test Product ' + Date.now(),
      category: 'Primary',
      unit: 'Nos',
      openingQty: 10,
      openingRate: 1000,
      openingValue: 10000,
      hsn: '1234',
      gstApplicable: 'Yes',
      igstRate: 18
    });
    console.log('✓ Stock item created successfully!');
    return true;
  } catch (error) {
    console.error('✗ Stock item creation failed:', error.message);
    return false;
  }
}

async function testGetAllStockItems() {
  console.log('\nTesting get all stock items...');
  try {
    const result = await tally.getAllStockItems();
    console.log('✓ Stock items retrieved successfully!');
    return true;
  } catch (error) {
    console.error('✗ Get stock items failed:', error.message);
    return false;
  }
}

async function testGetStockSummary() {
  console.log('\nTesting stock summary...');
  try {
    const result = await tally.getStockSummary();
    console.log('✓ Stock summary retrieved successfully!');
    return true;
  } catch (error) {
    console.error('✗ Get stock summary failed:', error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('================================');
  console.log('TALLY INTEGRATION TEST SUITE');
  console.log('================================\n');

  const connectionOk = await testConnection();
  
  if (!connectionOk) {
    console.log('\n❌ Connection failed. Please check:');
    console.log('1. Tally is running');
    console.log('2. ODBC Server is enabled in Tally (Alt+O > F12 > Configure)');
    console.log('3. Company name in .env matches exactly');
    console.log('4. Port 9000 is accessible');
    return;
  }

  // Run other tests if connection is successful
  await testGetAllLedgers();
  await testCreateLedger();
  await testGetAllStockItems();
  await testCreateStockItem();
  await testGetStockSummary();

  console.log('\n================================');
  console.log('TESTS COMPLETED');
  console.log('================================');
}

// Run tests
runTests().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});
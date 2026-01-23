// example-usage.js - Example usage patterns for the Tally connector
require('dotenv').config();
const TallyConnector = require('./tally-connector');

// Initialize Tally connector
const tally = new TallyConnector({
  host: process.env.TALLY_HOST || 'localhost',
  port: process.env.TALLY_PORT || 9000,
  company: process.env.TALLY_COMPANY || ''
});

// ==================== EXAMPLE 1: Customer Management ====================

async function example1_CreateCustomer() {
  console.log('Example 1: Creating a new customer ledger...\n');
  
  try {
    const customerData = {
      name: 'Global Tech Solutions',
      parent: 'Sundry Debtors',
      openingBalance: 0,
      email: 'contact@globaltech.com',
      mobile: '9876543210',
      address: '123 Tech Park, Electronic City, Bangalore',
      gstin: '29ABCDE1234F1Z5',
      gstType: 'Regular',
      state: 'Karnataka',
      pincode: '560100',
      country: 'India'
    };

    const result = await tally.createLedger(customerData);
    console.log('✓ Customer created successfully!');
    console.log(result);
  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

// ==================== EXAMPLE 2: Product Catalog ====================

async function example2_CreateProducts() {
  console.log('\nExample 2: Creating product catalog...\n');
  
  const products = [
    {
      name: 'Laptop - Dell Inspiron 15',
      category: 'Electronics',
      unit: 'Nos',
      openingQty: 25,
      openingRate: 45000,
      openingValue: 1125000,
      hsn: '8471',
      gstApplicable: 'Yes',
      igstRate: 18,
      cgstRate: 9,
      sgstRate: 9
    },
    {
      name: 'Mouse - Logitech Wireless',
      category: 'Electronics',
      unit: 'Nos',
      openingQty: 100,
      openingRate: 500,
      openingValue: 50000,
      hsn: '8471',
      gstApplicable: 'Yes',
      igstRate: 18,
      cgstRate: 9,
      sgstRate: 9
    },
    {
      name: 'Keyboard - Mechanical RGB',
      category: 'Electronics',
      unit: 'Nos',
      openingQty: 50,
      openingRate: 3000,
      openingValue: 150000,
      hsn: '8471',
      gstApplicable: 'Yes',
      igstRate: 18,
      cgstRate: 9,
      sgstRate: 9
    }
  ];

  for (const product of products) {
    try {
      await tally.createStockItem(product);
      console.log(`✓ Created: ${product.name}`);
    } catch (error) {
      console.error(`✗ Failed to create ${product.name}:`, error.message);
    }
  }
}

// ==================== EXAMPLE 3: Sales Order Processing ====================

async function example3_CreateSalesOrder() {
  console.log('\nExample 3: Creating a sales order...\n');
  
  try {
    const orderData = {
      date: '20250123', // YYYYMMDD format
      voucherNumber: 'SO-2025-001',
      partyName: 'Global Tech Solutions',
      totalAmount: 96500,
      items: [
        {
          name: 'Laptop - Dell Inspiron 15',
          quantity: 2,
          rate: 45000,
          amount: 90000
        },
        {
          name: 'Mouse - Logitech Wireless',
          quantity: 5,
          rate: 500,
          amount: 2500
        },
        {
          name: 'Keyboard - Mechanical RGB',
          quantity: 1,
          rate: 3000,
          amount: 3000
        }
      ]
    };

    const result = await tally.createSalesVoucher(orderData);
    console.log('✓ Sales order created successfully!');
    console.log('Order Number:', orderData.voucherNumber);
    console.log('Total Amount: ₹', orderData.totalAmount);
  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

// ==================== EXAMPLE 4: Purchase Order ====================

async function example4_CreatePurchaseOrder() {
  console.log('\nExample 4: Creating a purchase order...\n');
  
  try {
    const purchaseData = {
      date: '20250123',
      voucherNumber: 'PO-2025-001',
      partyName: 'Tech Suppliers India',
      totalAmount: 450000,
      items: [
        {
          name: 'Laptop - Dell Inspiron 15',
          quantity: 10,
          rate: 45000,
          amount: 450000
        }
      ]
    };

    const result = await tally.createPurchaseVoucher(purchaseData);
    console.log('✓ Purchase order created successfully!');
    console.log('PO Number:', purchaseData.voucherNumber);
  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

// ==================== EXAMPLE 5: Get Inventory Status ====================

async function example5_GetInventoryStatus() {
  console.log('\nExample 5: Fetching inventory status...\n');
  
  try {
    const stockSummary = await tally.getStockSummary();
    console.log('✓ Stock summary retrieved!');
    console.log(JSON.stringify(stockSummary, null, 2));
  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

// ==================== EXAMPLE 6: Get All Customers ====================

async function example6_GetAllCustomers() {
  console.log('\nExample 6: Fetching all customers...\n');
  
  try {
    const ledgers = await tally.getAllLedgers();
    console.log('✓ Ledgers retrieved!');
    // You can filter for only Sundry Debtors (customers) if needed
    console.log(JSON.stringify(ledgers, null, 2));
  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

// ==================== EXAMPLE 7: Update Customer Details ====================

async function example7_UpdateCustomer() {
  console.log('\nExample 7: Updating customer details...\n');
  
  try {
    const updateData = {
      email: 'newemail@globaltech.com',
      mobile: '9999888877',
      address: '456 New Address, Tech City, Bangalore'
    };

    const result = await tally.updateLedger('Global Tech Solutions', updateData);
    console.log('✓ Customer updated successfully!');
  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

// ==================== EXAMPLE 8: Bulk Operations ====================

async function example8_BulkCreateSuppliers() {
  console.log('\nExample 8: Bulk creating suppliers...\n');
  
  const suppliers = [
    {
      name: 'Tech Suppliers India',
      parent: 'Sundry Creditors',
      email: 'contact@techsuppliers.com',
      mobile: '9111222333'
    },
    {
      name: 'Electronics Wholesale Co',
      parent: 'Sundry Creditors',
      email: 'info@electronicswholesale.com',
      mobile: '9444555666'
    },
    {
      name: 'Components Direct Ltd',
      parent: 'Sundry Creditors',
      email: 'sales@componentsdirect.com',
      mobile: '9777888999'
    }
  ];

  const results = [];
  
  for (const supplier of suppliers) {
    try {
      await tally.createLedger(supplier);
      results.push({ name: supplier.name, status: 'success' });
      console.log(`✓ Created: ${supplier.name}`);
    } catch (error) {
      results.push({ name: supplier.name, status: 'failed', error: error.message });
      console.error(`✗ Failed: ${supplier.name}`);
    }
  }
  
  console.log('\nBulk operation summary:');
  console.table(results);
}

// ==================== EXAMPLE 9: Get Specific Product Details ====================

async function example9_GetProductDetails() {
  console.log('\nExample 9: Getting specific product details...\n');
  
  try {
    const product = await tally.getStockItem('Laptop - Dell Inspiron 15');
    console.log('✓ Product details retrieved!');
    console.log(JSON.stringify(product, null, 2));
  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

// ==================== EXAMPLE 10: Complete Workflow ====================

async function example10_CompleteWorkflow() {
  console.log('\nExample 10: Complete order processing workflow...\n');
  
  try {
    // Step 1: Check if customer exists
    console.log('Step 1: Checking customer...');
    let customer;
    try {
      customer = await tally.getLedger('Workflow Customer Ltd');
      console.log('✓ Customer exists');
    } catch (error) {
      // Customer doesn't exist, create it
      console.log('Creating new customer...');
      await tally.createLedger({
        name: 'Workflow Customer Ltd',
        parent: 'Sundry Debtors',
        email: 'contact@workflow.com',
        mobile: '9876543210'
      });
      console.log('✓ Customer created');
    }

    // Step 2: Check inventory
    console.log('\nStep 2: Checking inventory...');
    const stockSummary = await tally.getStockSummary();
    console.log('✓ Inventory checked');

    // Step 3: Create sales order
    console.log('\nStep 3: Creating sales order...');
    await tally.createSalesVoucher({
      date: '20250123',
      voucherNumber: 'WF-SO-001',
      partyName: 'Workflow Customer Ltd',
      totalAmount: 48000,
      items: [
        {
          name: 'Laptop - Dell Inspiron 15',
          quantity: 1,
          rate: 45000,
          amount: 45000
        },
        {
          name: 'Mouse - Logitech Wireless',
          quantity: 6,
          rate: 500,
          amount: 3000
        }
      ]
    });
    console.log('✓ Sales order created');

    console.log('\n✓ Workflow completed successfully!');
  } catch (error) {
    console.error('✗ Workflow error:', error.message);
  }
}

// ==================== RUN EXAMPLES ====================

async function runExamples() {
  console.log('========================================');
  console.log('TALLY CONNECTOR - USAGE EXAMPLES');
  console.log('========================================\n');

  // Uncomment the examples you want to run:
  
  // await example1_CreateCustomer();
  // await example2_CreateProducts();
  // await example3_CreateSalesOrder();
  // await example4_CreatePurchaseOrder();
  // await example5_GetInventoryStatus();
  // await example6_GetAllCustomers();
  // await example7_UpdateCustomer();
  // await example8_BulkCreateSuppliers();
  // await example9_GetProductDetails();
  await example10_CompleteWorkflow();

  console.log('\n========================================');
  console.log('EXAMPLES COMPLETED');
  console.log('========================================');
}

// Run the examples
if (require.main === module) {
  runExamples().catch(error => {
    console.error('Example execution error:', error);
    process.exit(1);
  });
}

module.exports = {
  example1_CreateCustomer,
  example2_CreateProducts,
  example3_CreateSalesOrder,
  example4_CreatePurchaseOrder,
  example5_GetInventoryStatus,
  example6_GetAllCustomers,
  example7_UpdateCustomer,
  example8_BulkCreateSuppliers,
  example9_GetProductDetails,
  example10_CompleteWorkflow
};  
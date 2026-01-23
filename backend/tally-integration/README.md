# Tally Integration Module

A comprehensive Node.js module for integrating Tally ERP with your applications. Supports complete CRUD operations for ledgers, stock items, orders, and inventory management.

## 📦 Features

- ✅ **Ledger Management** - Create, Read, Update, Delete ledgers (customers/suppliers)
- ✅ **Inventory Management** - Manage stock items with full CRUD operations
- ✅ **Order Processing** - Create and manage sales/purchase orders
- ✅ **Stock Reports** - Get real-time inventory summaries
- ✅ **REST API** - Ready-to-use Express server
- ✅ **Reusable** - Use across multiple projects
- ✅ **Type Safe** - Well-documented parameters

## 🚀 Quick Start

### 1. Installation

```bash
# Clone or copy the files to your project
npm install
```

### 2. Configure Tally

1. Open Tally
2. Press `Alt + O` (Configuration)
3. Press `F12` (Configure)
4. Enable **ODBC Server**
5. Set port to **9000** (default)
6. Note your company name exactly as shown in Tally

### 3. Configure Environment

Edit `.env` file:

```env
TALLY_HOST=localhost
TALLY_PORT=9000
TALLY_COMPANY=Your Company Name  # Must match exactly!
PORT=3000
```

### 4. Test Connection

```bash
npm run test
```

### 5. Start Server

```bash
npm start

# For development with auto-reload
npm run dev
```

Server runs at: `http://localhost:3000`

## 📖 Usage Examples

### Using the Module Directly

```javascript
const TallyConnector = require('./tally-connector');

const tally = new TallyConnector({
  host: 'localhost',
  port: 9000,
  company: 'My Company'
});

// Create a customer
const customer = await tally.createLedger({
  name: 'Acme Corp',
  parent: 'Sundry Debtors',
  email: 'contact@acme.com',
  mobile: '9876543210',
  gstin: '29ABCDE1234F1Z5'
});

// Create a product
const product = await tally.createStockItem({
  name: 'Laptop Dell XPS',
  unit: 'Nos',
  openingQty: 10,
  openingRate: 85000,
  hsn: '8471'
});

// Create sales order
const order = await tally.createSalesVoucher({
  partyName: 'Acme Corp',
  totalAmount: 170000,
  items: [
    { name: 'Laptop Dell XPS', quantity: 2, rate: 85000, amount: 170000 }
  ]
});
```

### Using the REST API

```javascript
// Frontend - React/Vue/Angular
const API_URL = 'http://localhost:3000/api';

// Create customer
const response = await fetch(`${API_URL}/ledgers`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Acme Corp',
    parent: 'Sundry Debtors',
    email: 'contact@acme.com'
  })
});

// Get all products
const products = await fetch(`${API_URL}/stock-items`);
const data = await products.json();

// Create sales order
const order = await fetch(`${API_URL}/orders/sales`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    partyName: 'Acme Corp',
    totalAmount: 50000,
    items: [...]
  })
});
```

## 🔌 API Endpoints

### Ledgers (Customers/Suppliers)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ledgers` | Create ledger |
| GET | `/api/ledgers` | Get all ledgers |
| GET | `/api/ledgers/:name` | Get single ledger |
| PUT | `/api/ledgers/:name` | Update ledger |
| DELETE | `/api/ledgers/:name` | Delete ledger |

### Stock Items (Products)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/stock-items` | Create stock item |
| GET | `/api/stock-items` | Get all stock items |
| GET | `/api/stock-items/:name` | Get single item |
| PUT | `/api/stock-items/:name` | Update item |
| DELETE | `/api/stock-items/:name` | Delete item |

### Orders (Vouchers)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/orders/sales` | Create sales order |
| POST | `/api/orders/purchase` | Create purchase order |
| GET | `/api/orders/:type` | Get all orders by type |
| GET | `/api/orders/:type/:number` | Get single order |

### Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventory/summary` | Get stock summary |
| GET | `/api/company/info` | Get company info |

## 📋 Request Examples

### Create Ledger (Customer)

```json
POST /api/ledgers

{
  "name": "ABC Corporation",
  "parent": "Sundry Debtors",
  "openingBalance": 50000,
  "email": "contact@abc.com",
  "mobile": "9876543210",
  "address": "123 Business St, Bangalore",
  "gstin": "29ABCDE1234F1Z5",
  "state": "Karnataka",
  "pincode": "560001"
}
```

### Create Stock Item

```json
POST /api/stock-items

{
  "name": "Laptop - Dell XPS 15",
  "category": "Electronics",
  "unit": "Nos",
  "openingQty": 10,
  "openingRate": 85000,
  "openingValue": 850000,
  "hsn": "8471",
  "gstApplicable": "Yes",
  "igstRate": 18
}
```

### Create Sales Order

```json
POST /api/orders/sales

{
  "date": "20250123",
  "voucherNumber": "SO-001",
  "partyName": "ABC Corporation",
  "totalAmount": 170000,
  "items": [
    {
      "name": "Laptop - Dell XPS 15",
      "quantity": 2,
      "rate": 85000,
      "amount": 170000
    }
  ]
}
```

## 🔧 Module Methods

### Ledger Operations

```javascript
tally.createLedger(ledgerData)
tally.getLedger(ledgerName)
tally.getAllLedgers()
tally.updateLedger(ledgerName, updateData)
tally.deleteLedger(ledgerName)
```

### Stock Item Operations

```javascript
tally.createStockItem(itemData)
tally.getStockItem(itemName)
tally.getAllStockItems()
tally.updateStockItem(itemName, updateData)
tally.deleteStockItem(itemName)
```

### Voucher Operations

```javascript
tally.createSalesVoucher(voucherData)
tally.createPurchaseVoucher(voucherData)
tally.getVoucher(voucherNumber, voucherType)
tally.getAllVouchers(voucherType, fromDate, toDate)
```

### Reports

```javascript
tally.getStockSummary()
tally.getCompanyInfo()
```

## 🎯 Use in Multiple Projects

### Option 1: Copy Files

Copy these files to your new project:
- `tally-connector.js`
- `server.js` (if using REST API)
- `package.json`
- `.env`

### Option 2: NPM Package (Local)

```bash
# In your tally module directory
npm link

# In your project directory
npm link tally-integration-api
```

### Option 3: Git Submodule

```bash
git submodule add <your-repo-url> lib/tally-integration
```

## ⚙️ Important Configuration

### Tally Settings

1. **Enable ODBC**: `Alt + O` → `F12` → Enable ODBC Server
2. **Port**: Default 9000
3. **Company**: Must match exactly (case-sensitive)

### Date Format

Tally uses `YYYYMMDD` format:
- January 23, 2025 = `20250123`

### Common Ledger Parents

- `Sundry Debtors` - For customers
- `Sundry Creditors` - For suppliers
- `Bank Accounts` - For bank ledgers
- `Cash-in-Hand` - For cash accounts

### Common Voucher Types

- `Sales` - Sales orders
- `Purchase` - Purchase orders
- `Payment` - Payment vouchers
- `Receipt` - Receipt vouchers
- `Journal` - Journal entries

## 🐛 Troubleshooting

### Connection Failed

**Check:**
1. Tally is running
2. ODBC Server is enabled
3. Company name matches exactly
4. Port 9000 is accessible
5. Firewall allows connection

### XML Parsing Errors

**Solutions:**
- Escape special characters in names
- Verify all required fields are present
- Check date format (YYYYMMDD)

### Ledger/Item Already Exists

Use `ACTION="Alter"` instead of `ACTION="Create"` to update existing records.

## 📁 Project Structure

```
tally-integration/
├── tally-connector.js    # Core module
├── server.js             # Express API
├── test.js               # Test suite
├── package.json
├── .env                  # Configuration
├── .gitignore
└── README.md
```

## 🤝 Contributing

Feel free to extend the module with additional Tally operations:
- Payment vouchers
- Receipt vouchers
- Journal entries
- Reports (P&L, Balance Sheet)
- Cost centers
- Custom fields

## 📄 License

MIT

## 🆘 Support

For Tally XML API documentation, visit Tally's official developer portal.

## ✨ Credits

Built with Node.js, Express, Axios, and xml2js.
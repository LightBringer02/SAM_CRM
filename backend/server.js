// backend/server.js
const express = require('express');
const cors = require('cors');
const inventoryRoutes = require('./routes/inventory');
const vouchersRoutes = require('./routes/vouchers');

const app = express();
app.use(cors());
app.use(express.json());


// Inventory API
app.use('/api/inventory', inventoryRoutes);
// Vouchers API
app.use('/api/vouchers', vouchersRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});

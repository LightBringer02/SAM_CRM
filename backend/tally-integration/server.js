// backend/tally-integration/server.js
const express = require('express');
const cors = require('cors');
const tallyRoutes = require('./routes/tally');

const app = express();
app.use(cors());
app.use(express.json());

// Tally Integration API
app.use('/api/tally', tallyRoutes);

const PORT = process.env.PORT || 4100;
app.listen(PORT, () => {
  console.log(`Tally Integration server running on port ${PORT}`);
});

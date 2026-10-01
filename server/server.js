const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const app = require('./app');
const connectDB = require('./config/db');
const mongoose = require('mongoose');
const PORT = process.env.PORT || 5000;

// Start without credentials so health can explain incomplete local setup.
const server = app.listen(PORT, () => {
  console.log(`Event API listening on http://localhost:${PORT}/api`);
  connectDB().catch(error => console.error(`[DATABASE] ${error.code}`));
});

function shutdown() {
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  server.close(async () => {
    await mongoose.disconnect().catch(() => {});
    clearTimeout(timeout);
    process.exit(0);
  });
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

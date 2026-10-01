const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const connectDB = require('../config/db');
const mongoose = require('mongoose');

(async () => {
  try {
    await connectDB();
    await mongoose.connection.db.admin().ping();
    console.log('MongoDB connection and ping succeeded.');
  } catch (error) {
    console.error(`MongoDB check failed: ${error.code || 'DATABASE_PING_FAILED'}.`);
    console.error('Check MONGODB_URI, Atlas database-user credentials, network access, and cluster status.');
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
})();

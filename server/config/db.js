const mongoose = require('mongoose');

// One pool per warm Vercel process; concurrent requests share the same attempt.
// Driver errors can contain connection details, so only safe errors escape here.
function createConnectionManager(driver, env = process.env) {
  let pending;
  driver.set('bufferCommands', false);
  async function connectDB() {
    if (!env.MONGODB_URI) {
      const error = new Error('Database is not configured.');
      error.code = 'DATABASE_NOT_CONFIGURED';
      throw error;
    }
    if (driver.connection.readyState === 1) return driver;
    if (!pending) {
      pending = Promise.resolve().then(() => driver.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 15000,
        waitQueueTimeoutMS: 5000,
        maxPoolSize: 10,
        minPoolSize: 0,
        maxIdleTimeMS: 60000
      })).catch(() => {
        const error = new Error('Database is temporarily unavailable.');
        error.code = 'DATABASE_CONNECTION_FAILED';
        throw error;
      }).finally(() => { pending = undefined; });
    }
    return pending;
  }
  connectDB.getStatus = () => ({
    configured: Boolean(env.MONGODB_URI),
    connected: driver.connection.readyState === 1
  });
  return connectDB;
}

module.exports = createConnectionManager(mongoose);
module.exports.createConnectionManager = createConnectionManager;

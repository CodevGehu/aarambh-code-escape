const path = require('node:path');
const fs = require('node:fs/promises');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
if (process.env.DB_CHECK_PUBLIC_DNS === '1') require('node:dns').setServers(['1.1.1.1', '8.8.8.8']);
const { installEarlyQuestions } = require('../services/installEarlyQuestions');
async function run() {
  if (!process.env.MONGODB_URI) throw new Error('Database configuration missing; no questions installed.');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000, connectTimeoutMS: 15000, maxPoolSize: 2 });
  if (mongoose.connection.db.databaseName !== 'aarambh_code_escape') throw new Error('This command only targets the Aarambh event database.');
  const report = await installEarlyQuestions({ apply: process.argv.includes('--apply'), backup: async questions => {
    const directory = path.join(__dirname, '..', '..', '.private', 'question-backups'); await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, `before-rounds-1-3-${Date.now()}.json`), JSON.stringify(questions, null, 2), { flag: 'wx' });
  } }); console.log(JSON.stringify(report, null, 2));
}
run().catch(error => { console.error(/Mongo|Mongoose/.test(error.name || '') ? 'Database connection unavailable; no questions installed.' : error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());

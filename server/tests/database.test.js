const test = require('node:test');
const assert = require('node:assert/strict');
const { createConnectionManager } = require('../config/db');

function fakeDriver(connect) {
  return { connection: { readyState: 0 }, set(key, value) {
    assert.equal(key, 'bufferCommands'); assert.equal(value, false);
  }, connect };
}

test('missing configuration rejects safely without connecting or exiting', async () => {
  let calls = 0;
  const connect = createConnectionManager(fakeDriver(() => calls++), {});
  await assert.rejects(connect(), { code: 'DATABASE_NOT_CONFIGURED' });
  assert.equal(calls, 0);
  assert.deepEqual(connect.getStatus(), { configured: false, connected: false });
});

test('concurrent cold requests share a single pool and warm requests reuse it', async () => {
  let calls = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const driver = fakeDriver(async (uri, options) => {
    calls++;
    assert.equal(uri, 'mongodb://test-only');
    assert.equal(options.serverSelectionTimeoutMS, 5000);
    assert.equal(options.connectTimeoutMS, 5000);
    assert.equal(options.maxPoolSize, 10);
    await gate;
    driver.connection.readyState = 1;
    return driver;
  });
  const connect = createConnectionManager(driver, { MONGODB_URI: 'mongodb://test-only' });
  const requests = [connect(), connect(), connect()];
  await Promise.resolve();
  assert.equal(calls, 1);
  release();
  const results = await Promise.all(requests);
  assert.ok(results.every(result => result === driver));
  assert.equal(await connect(), driver);
  assert.equal(calls, 1);
});

test('failed attempts clear the cache, sanitize errors, and allow a later retry', async () => {
  let calls = 0;
  const driver = fakeDriver(async () => {
    calls++;
    if (calls === 1) throw new Error('private password and URI');
    driver.connection.readyState = 1;
    return driver;
  });
  const connect = createConnectionManager(driver, { MONGODB_URI: 'mongodb://test-only' });
  await assert.rejects(connect(), error => {
    assert.equal(error.code, 'DATABASE_CONNECTION_FAILED');
    assert.equal(error.message, 'Database is temporarily unavailable.');
    assert.equal(error.cause, undefined);
    return true;
  });
  assert.equal(await connect(), driver);
  assert.equal(calls, 2);
});

test('a disconnected warm pool opens a fresh connection', async () => {
  let calls = 0;
  const driver = fakeDriver(async () => { calls++; driver.connection.readyState = 1; return driver; });
  const connect = createConnectionManager(driver, { MONGODB_URI: 'mongodb://test-only' });
  await connect();
  driver.connection.readyState = 0;
  await connect();
  assert.equal(calls, 2);
});

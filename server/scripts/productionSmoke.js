// Read-only production checks: never starts/resets a game or submits answers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function run() {
  const target = process.argv[2] || 'https://aarambh-code-escape.vercel.app';
  const origin = new URL(target);
  assert.equal(origin.protocol, 'https:');
  const results = [];
  for (const [route, expected] of [
    ['/', 200], ['/admin', 200], ['/api/health', 200], ['/api/quiz/status', 200],
    ['/api/auth/me', 401], ['/api/questions/1', 401], ['/api/progress/state', 401],
    ['/api/admin/teams', 401], ['/api/admin/logs', 401], ['/api/export/excel', 401],
    ['/api/quiz/config', 401], ['/api/not-an-endpoint', 404],
  ]) {
    const response = await fetch(new URL(route, origin), { signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, expected, `${route} HTTP status`);
    const body = await response.text();
    if (route === '/api/health') assert.equal(JSON.parse(body).status, 'ready');
    if (route.startsWith('/api/')) {
      assert.match(response.headers.get('cache-control') || '', /no-store/i);
      assert.ok(!/access_code_hash|active_session_id|mongodb(?:\+srv)?:\/\/|JWT_(?:TEAM|ADMIN)_SECRET/.test(body), `${route} secret leakage`);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff', `${route} MIME protection`);
    }
    results.push({ route, status: response.status, passed: true });
  }
  const report = { target: origin.origin, checkedAt: new Date().toISOString(),
    readOnly: true, noProductionCredentialsUsed: true, results };
  const destination = process.argv[3];
  if (destination) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify(report, null, 2));
}
run().catch(error => {
  console.error('Production smoke failed:', error instanceof assert.AssertionError ? error.message : 'network/request failure');
  process.exitCode = 1;
});

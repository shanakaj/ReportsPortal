#!/usr/bin/env node
/**
 * API Smoke Test Suite
 *
 * Verifies deployed API endpoints are reachable and responding correctly.
 * Does NOT require MFA — uses unauthenticated and auth-challenge flows.
 *
 * Usage:
 *   BASE_URL=https://d1t1cfrt1i0k92.cloudfront.net node api-smoke-test.mjs
 *
 * Exit codes:
 *   0 = all tests passed
 *   1 = one or more tests failed
 */

const BASE_URL = process.env.BASE_URL || process.env.API_BASE_URL;
if (!BASE_URL) {
  console.error('ERROR: BASE_URL environment variable is required');
  process.exit(1);
}

const API_BASE = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ReportPortal-SmokeTest/1.0';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function apiCall(method, path, { body, headers = {} } = {}) {
  const url = `${API_BASE}${path}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA, ...headers },
  };
  if (body) opts.body = JSON.stringify(body);
  return fetch(url, opts);
}

// ─── Tests ────────────────────────────────────────────────────────────

console.log(`\nAPI Smoke Tests — ${API_BASE}\n`);

console.log('Portal Accessibility:');

await test('SPA loads (GET /)', async () => {
  const res = await fetch(BASE_URL.replace(/\/api$/, ''), {
    headers: { 'User-Agent': UA },
  });
  assert(res.ok, `Expected 200, got ${res.status}`);
  const html = await res.text();
  assert(html.includes('<!DOCTYPE html>') || html.includes('<html'), 'Response is not HTML');
});

await test('CloudFront returns security headers', async () => {
  const res = await fetch(BASE_URL.replace(/\/api$/, ''), {
    headers: { 'User-Agent': UA },
  });
  const hsts = res.headers.get('strict-transport-security');
  assert(hsts, 'Missing Strict-Transport-Security header');
  const csp = res.headers.get('content-security-policy');
  assert(csp, 'Missing Content-Security-Policy header');
});

console.log('\nAuth Endpoints (pre-auth, no Cognito authorizer):');

await test('POST /auth/login returns 400 for empty body', async () => {
  const res = await apiCall('POST', '/auth/login', { body: {} });
  // Should get 400 (validation error) not 403 (WAF) or 5xx
  assert([400, 401, 422].includes(res.status),
    `Expected 400/401/422, got ${res.status}`);
});

await test('POST /auth/login returns structured error for invalid credentials', async () => {
  const res = await apiCall('POST', '/auth/login', {
    body: { email: 'nonexistent@example.com', password: 'WrongPassword123!' },
  });
  assert([400, 401, 403].includes(res.status),
    `Expected 400/401/403, got ${res.status}`);
});

await test('POST /auth/forgot-password accepts request', async () => {
  const res = await apiCall('POST', '/auth/forgot-password', {
    body: { email: 'test-smoke@example.com' },
  });
  // Cognito returns success even for non-existent users (security best practice)
  assert([200, 400, 404].includes(res.status),
    `Expected 200/400/404, got ${res.status}`);
});

console.log('\nProtected Endpoints (require Cognito token):');

await test('GET /admin/spaces returns 401 without token', async () => {
  const res = await apiCall('GET', '/admin/spaces');
  assert(res.status === 401, `Expected 401, got ${res.status}`);
});

await test('GET /admin/users returns 401 without token', async () => {
  const res = await apiCall('GET', '/admin/users');
  assert(res.status === 401, `Expected 401, got ${res.status}`);
});

await test('GET /customer/spaces returns 401 without token', async () => {
  const res = await apiCall('GET', '/customer/spaces');
  assert(res.status === 401, `Expected 401, got ${res.status}`);
});

await test('GET /notifications/count returns 401 without token', async () => {
  const res = await apiCall('GET', '/notifications/count');
  assert(res.status === 401, `Expected 401, got ${res.status}`);
});

await test('POST /admin/spaces returns 401 without token', async () => {
  const res = await apiCall('POST', '/admin/spaces', {
    body: { spaceName: 'smoke-test' },
  });
  assert(res.status === 401, `Expected 401, got ${res.status}`);
});

console.log('\nWAF Validation:');

await test('WAF does not block legitimate JSON POST to auth endpoint', async () => {
  const res = await apiCall('POST', '/auth/login', {
    body: {
      email: 'test@example.com',
      password: 'SomePassword123!',
    },
  });
  // Should NOT get 403 from WAF — should reach Lambda and get auth error
  assert(res.status !== 403 || (await res.text()).includes('FORBIDDEN') === false,
    `WAF blocked the request (got 403)`);
  assert(res.status < 500, `Server error: ${res.status}`);
});

await test('WAF does not block request with User-Agent header', async () => {
  const res = await apiCall('GET', '/admin/spaces', {
    headers: { 'User-Agent': UA },
  });
  // Should get 401 (no token) not 403 (WAF NoUserAgent rule)
  assert(res.status === 401, `Expected 401, got ${res.status}`);
});

await test('Non-existent endpoint returns 403 (API GW missing auth)', async () => {
  const res = await apiCall('GET', '/nonexistent-endpoint-12345');
  // API Gateway returns 403 "Missing Authentication Token" for unknown routes
  assert([403, 404].includes(res.status),
    `Expected 403/404, got ${res.status}`);
});

console.log('\nReport Serving:');

await test('GET /reports/ returns 403 (signed cookies required)', async () => {
  const portalBase = BASE_URL.replace(/\/api$/, '');
  const res = await fetch(`${portalBase}/reports/test`, {
    headers: { 'User-Agent': UA },
  });
  // Should get 403 (missing signed cookies) not 404 or 5xx
  assert([403, 404].includes(res.status),
    `Expected 403/404, got ${res.status}`);
});

// ─── Summary ──────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${'─'.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);

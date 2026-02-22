/**
 * Dev-only smoke test for connector dev routes.
 * Run with: node backend/scripts/test-connector-dev.js
 * Requires backend at http://127.0.0.1:5000 and NODE_ENV=development.
 * Override base URL via env BASE_URL (default 127.0.0.1 to avoid IPv6 on Windows).
 */
const base = process.env.BASE_URL || 'http://127.0.0.1:5000'.replace(/\/$/, '');

async function request(method, path, body) {
  const url = path.startsWith('http') ? path : `${base}${path}`;
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined && (method === 'POST' || method === 'PUT')) {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function main() {
  console.log('Base URL (in use):', base);
  console.log('');

  const r1 = await request('GET', '/api/connector/dev/routes');
  console.log('GET /api/connector/dev/routes ->', r1.status, JSON.stringify(r1.data, null, 2));
  console.log('');

  const r2 = await request('GET', '/api/connector/dev/devices');
  console.log('GET /api/connector/dev/devices ->', r2.status, JSON.stringify(r2.data, null, 2));
  console.log('');

  const r3 = await request('POST', '/api/connector/dev/create-device', {});
  console.log('POST /api/connector/dev/create-device ->', r3.status, JSON.stringify(r3.data, null, 2));
  console.log('');

  const ok = r1.status === 200 && r2.status === 200 && r3.status === 200;
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

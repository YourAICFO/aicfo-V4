#!/usr/bin/env node
/**
 * Usage:
 *   API_BASE_URL=https://api.example.com \
 *   USER_JWT=... \
 *   COMPANY_ID=... \
 *   CONNECTOR_TOKEN=... \
 *   node backend/scripts/smoke_connector_balances_v1.js
 */

const fs = require('fs');
const path = require('path');

const API_BASE_URL = (process.env.API_BASE_URL || '').replace(/\/+$/, '');
const USER_JWT = process.env.USER_JWT || '';
const COMPANY_ID = process.env.COMPANY_ID || '';
const CONNECTOR_TOKEN = process.env.CONNECTOR_TOKEN || '';

if (!API_BASE_URL || !USER_JWT || !COMPANY_ID || !CONNECTOR_TOKEN) {
  console.error('Missing required env vars: API_BASE_URL, USER_JWT, COMPANY_ID, CONNECTOR_TOKEN');
  process.exit(1);
}

const fixturePath = path.join(__dirname, 'fixtures', 'connector_payload_sample.json');
const payload = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

const request = async (method, urlPath, token, body, extraHeaders = {}) => {
  const response = await fetch(`${API_BASE_URL}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...extraHeaders
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_err) {
    json = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`${method} ${urlPath} failed (${response.status}): ${JSON.stringify(json)}`);
  }

  return json;
};

const run = async () => {
  console.log('[smoke] starting connector sync run...');
  const start = await request('POST', '/api/connector/sync/start', CONNECTOR_TOKEN, {});
  const runId = start?.data?.runId;
  if (!runId) {
    throw new Error('No runId returned from /api/connector/sync/start');
  }
  console.log(`[smoke] runId=${runId}`);

  console.log('[smoke] uploading balances payload...');
  const syncResp = await request('POST', '/api/connector/sync', CONNECTOR_TOKEN, payload);
  console.log('[smoke] sync response:', JSON.stringify(syncResp?.data || syncResp));

  console.log('[smoke] marking run complete...');
  await request('POST', '/api/connector/sync/complete', CONNECTOR_TOKEN, {
    runId,
    status: 'success',
    finishedAt: new Date().toISOString(),
    lastError: null
  });

  console.log('[smoke] checking sync status...');
  const status = await request(
    'GET',
    '/api/sync/status',
    USER_JWT,
    null,
    { 'x-company-id': COMPANY_ID }
  );
  console.log('[smoke] /api/sync/status:', JSON.stringify(status?.data || status, null, 2));

  console.log('[smoke] checking dashboard overview...');
  const overview = await request(
    'GET',
    '/api/dashboard/overview',
    USER_JWT,
    null,
    { 'x-company-id': COMPANY_ID }
  );
  console.log('[smoke] /api/dashboard/overview:', JSON.stringify(overview?.data || overview, null, 2));

  console.log('[smoke] done');
};

run().catch((err) => {
  console.error('[smoke] failed:', err.message);
  process.exit(1);
});


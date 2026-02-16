#!/usr/bin/env node
/**
 * Usage:
 *   API_BASE_URL=https://api.example.com \
 *   USER_JWT=... \
 *   COMPANY_ID=... \
 *   node backend/scripts/smoke_connector_status.js
 */

const API_BASE_URL = (process.env.API_BASE_URL || '').replace(/\/+$/, '');
const USER_JWT = process.env.USER_JWT || '';
const COMPANY_ID = process.env.COMPANY_ID || '';

if (!API_BASE_URL || !USER_JWT || !COMPANY_ID) {
  console.error('Missing required env vars: API_BASE_URL, USER_JWT, COMPANY_ID');
  process.exit(1);
}

const run = async () => {
  const response = await fetch(
    `${API_BASE_URL}/api/connector/status?companyId=${encodeURIComponent(COMPANY_ID)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${USER_JWT}`,
        'x-company-id': COMPANY_ID
      }
    }
  );

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch (_err) {
    payload = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${JSON.stringify(payload)}`);
  }

  console.log(JSON.stringify(payload, null, 2));
};

run().catch((err) => {
  console.error('[smoke-connector-status] failed:', err.message);
  process.exit(1);
});

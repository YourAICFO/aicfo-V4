const test = require('node:test');
const assert = require('node:assert/strict');

const { generateAIInsights } = require('../src/worker/tasks/generateAIInsights');

test('generateAIInsights stores insight', async (t) => {
  const key = process.env.OPENAI_API_KEY || '';
  if (!key || key.length < 30 || key.includes('your-') || !process.env.DATABASE_URL) {
    return t.skip('OPENAI_API_KEY not configured (placeholder or missing) or DATABASE_URL not set');
  }

  const result = await generateAIInsights({
    companyId: '00000000-0000-0000-0000-000000000000'
  });

  assert.ok(result);
});

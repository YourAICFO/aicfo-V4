const test = require('node:test');
const assert = require('node:assert/strict');

const { generateAIInsights } = require('../src/worker/tasks/generateAIInsights');

test('generateAIInsights stores insight', async (t) => {
  if (!process.env.OPENAI_API_KEY || !process.env.DATABASE_URL) {
    t.skip('OPENAI_API_KEY or DATABASE_URL not set');
  }

  const result = await generateAIInsights({
    companyId: '00000000-0000-0000-0000-000000000000'
  });

  assert.ok(result);
});

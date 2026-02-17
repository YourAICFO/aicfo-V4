/* eslint-disable no-console */
const run = async () => {
  const apiBase = process.env.API_BASE_URL;
  const jwt = process.env.USER_JWT;
  const companyId = process.env.COMPANY_ID;
  const missingQuestion = process.env.MISSING_QUESTION || 'What is my cash conversion cycle?';
  const availableQuestion = process.env.AVAILABLE_QUESTION || 'What is my cash runway?';

  if (!apiBase || !jwt || !companyId) {
    console.error('Required env: API_BASE_URL, USER_JWT, COMPANY_ID');
    process.exit(1);
  }

  const ask = async (message) => {
    const res = await fetch(`${apiBase.replace(/\/$/, '')}/api/ai/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'X-Company-Id': companyId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
    });
    const json = await res.json();
    return { status: res.status, json };
  };

  const missingResult = await ask(missingQuestion);
  console.log('Missing-metric check:', JSON.stringify(missingResult.json, null, 2));
  if (!missingResult.json?.success || missingResult.json?.data?.matched !== false) {
    console.error('Expected matched=false for missing metric question');
    process.exit(2);
  }
  if (!Array.isArray(missingResult.json?.data?.missing?.metrics)) {
    console.error('Expected missing.metrics array in strict mode response');
    process.exit(3);
  }

  const availableResult = await ask(availableQuestion);
  console.log('Stored-metric check:', JSON.stringify(availableResult.json, null, 2));
  if (!availableResult.json?.success) {
    console.error('Available metric check failed');
    process.exit(4);
  }
  console.log('Strict mode smoke checks completed.');
};

run().catch((error) => {
  console.error(error);
  process.exit(10);
});

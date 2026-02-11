const { z } = require('zod');

class ValidationError extends Error {
  constructor(issues = []) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.status = 400;
    this.issues = issues;
  }
}

const validate = (schema, payload) => {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new ValidationError(result.error.issues || []);
  }
  return result.data;
};

const zMonthStartString = z.string().regex(/^\d{4}-\d{2}-01$/, 'Expected YYYY-MM-01');
const zISODateString = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

module.exports = {
  validate,
  ValidationError,
  zMonthStartString,
  zISODateString,
  z
};

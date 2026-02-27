'use strict';

/**
 * Express middleware factories for zod-based request validation.
 * Returns 400 with { success:false, error:"INVALID_INPUT", details:[...] }
 * on validation failure; passes through on success with req.validatedBody / req.validatedQuery.
 */

function validateBody(zodSchema) {
  return (req, res, next) => {
    const result = zodSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_INPUT',
        details: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    req.validatedBody = result.data;
    next();
  };
}

function validateQuery(zodSchema) {
  return (req, res, next) => {
    const result = zodSchema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_INPUT',
        details: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    req.validatedQuery = result.data;
    next();
  };
}

module.exports = { validateBody, validateQuery };

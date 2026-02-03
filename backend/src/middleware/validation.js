const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name must be between 1 and 100 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name must be between 1 and 100 characters'),
  handleValidationErrors
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

const companyValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Company name is required and must be less than 255 characters'),
  body('industry')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Industry must be less than 100 characters'),
  body('currency')
    .optional()
    .isIn(['INR', 'USD', 'EUR', 'GBP'])
    .withMessage('Invalid currency'),
  handleValidationErrors
];

const transactionValidation = [
  body('date')
    .isISO8601()
    .withMessage('Valid date is required (YYYY-MM-DD)'),
  body('type')
    .isIn(['REVENUE', 'EXPENSE'])
    .withMessage('Type must be REVENUE or EXPENSE'),
  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required'),
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  body('description')
    .optional()
    .trim(),
  handleValidationErrors
];

const cashBalanceValidation = [
  body('date')
    .isISO8601()
    .withMessage('Valid date is required (YYYY-MM-DD)'),
  body('amount')
    .isFloat()
    .withMessage('Amount is required'),
  body('bankName')
    .optional()
    .trim(),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  registerValidation,
  loginValidation,
  companyValidation,
  transactionValidation,
  cashBalanceValidation
};

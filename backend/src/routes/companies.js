const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { companyValidation } = require('../middleware/validation');
const { companyService } = require('../services');

// GET /api/companies
router.get('/', authenticate, async (req, res) => {
  try {
    const includeDeleted = req.query.includeDeleted === 'true';
    const companies = await companyService.getUserCompanies(
      req.userId,
      { includeDeleted },
      req.user?.email
    );
    res.json({
      success: true,
      data: companies
    });
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/companies
router.post('/', authenticate, companyValidation, async (req, res) => {
  try {
    const company = await companyService.createCompany(req.userId, req.body);
    res.status(201).json({
      success: true,
      message: 'Company created successfully',
      data: company
    });
  } catch (error) {
    console.error('Create company error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/companies/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const company = await companyService.getCompanyById(req.params.id, req.userId);
    res.json({
      success: true,
      data: company
    });
  } catch (error) {
    console.error('Get company error:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /api/companies/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const company = await companyService.updateCompany(req.params.id, req.userId, req.body);
    res.json({
      success: true,
      message: 'Company updated successfully',
      data: company
    });
  } catch (error) {
    console.error('Update company error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/companies/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await companyService.deleteCompany(req.params.id, req.user.id, req.user?.email);
    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Delete company error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

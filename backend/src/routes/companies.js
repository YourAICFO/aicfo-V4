const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { companyValidation } = require('../middleware/validation');
const { companyService, demoSeedService } = require('../services');
const { Company } = require('../models');

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

// POST /api/companies/demo — create demo company (max 1 per user)
router.post('/demo', authenticate, async (req, res) => {
  try {
    const existing = await Company.count({ where: { ownerId: req.userId, isDemo: true, isDeleted: false } });
    if (existing >= 1) {
      return res.status(400).json({
        success: false,
        error: 'You already have a demo company. Use it or delete it to create another.'
      });
    }
    const { company } = await demoSeedService.createDemoCompany(req.userId);
    return res.status(201).json({
      success: true,
      message: 'Demo company created',
      data: company
    });
  } catch (error) {
    console.error('Create demo company error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create demo company'
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

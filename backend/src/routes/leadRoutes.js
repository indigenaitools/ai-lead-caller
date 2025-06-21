const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');

// All routes are protected by authMiddleware in server.js

// Get all leads
router.get('/', leadController.getLeads);

// Get single lead
router.get('/:id', leadController.getLeadById);

// Create new lead
router.post('/', leadController.createLead);

// Update lead
router.put('/:id', leadController.updateLead);

// Delete lead
router.delete('/:id', leadController.deleteLead);

// Add call history to lead
router.post('/:id/call', leadController.addCallHistory);

module.exports = router;
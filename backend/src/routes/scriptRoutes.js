const express = require('express');
const router = express.Router();
const scriptController = require('../controllers/scriptController');

// All routes are protected by authMiddleware in server.js

// Get default/public script templates
router.get('/defaults', scriptController.getDefaultScripts);

// Get all script templates
router.get('/', scriptController.getScripts);

// Get single script template
router.get('/:id', scriptController.getScriptById);

// Create new script template
router.post('/', scriptController.createScript);

// Update script template
router.put('/:id', scriptController.updateScript);

// Delete script template
router.delete('/:id', scriptController.deleteScript);

module.exports = router;
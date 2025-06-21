const express = require('express');
const router = express.Router();
const voiceController = require('../controllers/voiceController');

// All routes are protected by authMiddleware in server.js

// Get default/public voices
router.get('/defaults', voiceController.getDefaultVoices);

// Get all voices
router.get('/', voiceController.getVoices);

// Get single voice
router.get('/:id', voiceController.getVoiceById);

// Create new voice
router.post('/', voiceController.createVoice);

// Update voice
router.put('/:id', voiceController.updateVoice);

// Delete voice
router.delete('/:id', voiceController.deleteVoice);

// Test voice
router.post('/:id/test', voiceController.testVoice);

module.exports = router;
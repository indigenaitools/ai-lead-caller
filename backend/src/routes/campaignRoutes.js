const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');

// All routes are protected by authMiddleware in server.js

// Get all campaigns
router.get('/', campaignController.getCampaigns);

// Get single campaign
router.get('/:id', campaignController.getCampaignById);

// Create new campaign
router.post('/', campaignController.createCampaign);

// Update campaign
router.put('/:id', campaignController.updateCampaign);

// Delete campaign
router.delete('/:id', campaignController.deleteCampaign);

// Start campaign
router.post('/:id/start', campaignController.startCampaign);

// Pause campaign
router.post('/:id/pause', campaignController.pauseCampaign);

// Get campaign analytics
router.get('/:id/analytics', campaignController.getCampaignAnalytics);

// Start calling leads in campaign
router.post('/:id/start-calling', campaignController.startCalling);

// Call a specific lead
router.post('/:id/call-lead/:leadId', campaignController.callLead);

// Get active calls for campaign
router.get('/:id/active-calls', campaignController.getActiveCalls);

// End a specific call
router.post('/:id/end-call/:callId', campaignController.endCall);

module.exports = router;
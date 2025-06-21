const Campaign = require('../models/Campaign');
const Lead = require('../models/Lead');
const User = require('../models/User');
const ScriptTemplate = require('../models/ScriptTemplate');
const Voice = require('../models/Voice');
const { scrapingQueue, callingQueue, enrichmentQueue } = require('../workers/callWorker');
const callOrchestrator = require('../services/callOrchestrator');
const logger = require('../utils/logger');

/**
 * Get all campaigns for a user
 * @route GET /api/campaigns
 * @access Private
 */
exports.getCampaigns = async (req, res) => {
  try {
    const pageSize = Number(req.query.pageSize) || 10;
    const page = Number(req.query.page) || 1;
    const status = req.query.status;
    
    const filterOptions = { user: req.user.id };
    
    if (status) filterOptions.status = status;
    
    const count = await Campaign.countDocuments(filterOptions);
    
    const campaigns = await Campaign.find(filterOptions)
      .sort({ createdAt: -1 })
      .limit(pageSize)
      .skip(pageSize * (page - 1));
    
    res.json({
      campaigns,
      page,
      pages: Math.ceil(count / pageSize),
      total: count
    });
  } catch (error) {
    console.error('Error in getCampaigns:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get a single campaign by ID
 * @route GET /api/campaigns/:id
 * @access Private
 */
exports.getCampaignById = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    // Check if the campaign belongs to the user
    if (campaign.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to access this campaign' });
    }
    
    res.json(campaign);
  } catch (error) {
    console.error('Error in getCampaignById:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Create a new campaign
 * @route POST /api/campaigns
 * @access Private
 */
exports.createCampaign = async (req, res) => {
  try {
    const {
      name,
      description,
      targetIndustry,
      targetLocation,
      targetPositions,
      targetCompanySize,
      searchCriteria,
      callScript
    } = req.body;
    
    const campaign = new Campaign({
      user: req.user.id,
      name,
      description,
      targetIndustry,
      targetLocation,
      targetPositions,
      targetCompanySize,
      searchCriteria,
      callScript,
      status: 'draft'
    });
    
    const createdCampaign = await campaign.save();
    
    res.status(201).json(createdCampaign);
  } catch (error) {
    console.error('Error in createCampaign:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Update a campaign
 * @route PUT /api/campaigns/:id
 * @access Private
 */
exports.updateCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    // Check if the campaign belongs to the user
    if (campaign.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this campaign' });
    }
    
    // Update campaign fields
    Object.keys(req.body).forEach(key => {
      if (key !== 'user' && key !== '_id' && key !== 'leadsGenerated' && 
          key !== 'leadsContacted' && key !== 'leadsConverted') {
        campaign[key] = req.body[key];
      }
    });
    
    const updatedCampaign = await campaign.save();
    
    res.json(updatedCampaign);
  } catch (error) {
    console.error('Error in updateCampaign:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Delete a campaign
 * @route DELETE /api/campaigns/:id
 * @access Private
 */
exports.deleteCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    // Check if the campaign belongs to the user
    if (campaign.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this campaign' });
    }
    
    // Delete associated leads
    await Lead.deleteMany({ campaign: req.params.id });
    
    // Delete campaign
    await campaign.remove();
    
    res.json({ message: 'Campaign removed' });
  } catch (error) {
    console.error('Error in deleteCampaign:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Start a campaign
 * @route POST /api/campaigns/:id/start
 * @access Private
 */
exports.startCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    // Check if the campaign belongs to the user
    if (campaign.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to start this campaign' });
    }
    
    // Check if campaign is already active
    if (campaign.status === 'active') {
      return res.status(400).json({ message: 'Campaign is already active' });
    }
    
    // Check if user has enough credits
    const user = await User.findById(req.user.id);
    const requiredCredits = 10; // Example: 10 credits per campaign
    
    if (user.credits < requiredCredits) {
      return res.status(400).json({ 
        message: 'Not enough credits to start campaign',
        requiredCredits,
        userCredits: user.credits
      });
    }
    
    // Deduct credits
    user.credits -= requiredCredits;
    await user.save();
    
    // Update campaign status and start date
    campaign.status = 'active';
    campaign.startDate = new Date();
    await campaign.save();
    
    // Add job to scraping queue for lead generation
    const job = await scrapingQueue.add('scrape-leads', {
      campaignId: campaign._id,
      query: campaign.targetIndustry || campaign.name,
      location: campaign.targetLocation || 'United States',
      maxResults: campaign.maxLeads || 100
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    });
    
    res.json({
      message: 'Campaign started successfully',
      jobId: job.id,
      campaign
    });
  } catch (error) {
    console.error('Error in startCampaign:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Pause a campaign
 * @route POST /api/campaigns/:id/pause
 * @access Private
 */
exports.pauseCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    // Check if the campaign belongs to the user
    if (campaign.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to pause this campaign' });
    }
    
    // Check if campaign is active
    if (campaign.status !== 'active') {
      return res.status(400).json({ message: 'Campaign is not active' });
    }
    
    // Update campaign status
    campaign.status = 'paused';
    await campaign.save();
    
    res.json({
      message: 'Campaign paused successfully',
      campaign
    });
  } catch (error) {
    console.error('Error in pauseCampaign:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get campaign analytics
 * @route GET /api/campaigns/:id/analytics
 * @access Private
 */
exports.getCampaignAnalytics = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    // Check if the campaign belongs to the user
    if (campaign.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to access this campaign' });
    }
    
    // Get leads for this campaign
    const leads = await Lead.find({ campaign: req.params.id });
    
    // Calculate analytics
    const totalLeads = leads.length;
    const leadsByStatus = {
      new: leads.filter(lead => lead.status === 'new').length,
      contacted: leads.filter(lead => lead.status === 'contacted').length,
      qualified: leads.filter(lead => lead.status === 'qualified').length,
      converted: leads.filter(lead => lead.status === 'converted').length,
      rejected: leads.filter(lead => lead.status === 'rejected').length
    };
    
    // Calculate conversion rates
    const conversionRate = totalLeads > 0 
      ? (leadsByStatus.converted / totalLeads * 100).toFixed(2) 
      : 0;
    
    const qualificationRate = totalLeads > 0 
      ? ((leadsByStatus.qualified + leadsByStatus.converted) / totalLeads * 100).toFixed(2) 
      : 0;
    
    // Get call history data
    const callsData = leads.reduce((acc, lead) => {
      return acc.concat(lead.callHistory.map(call => ({
        leadId: lead._id,
        leadName: `${lead.firstName} ${lead.lastName}`,
        ...call.toObject()
      })));
    }, []);
    
    // Sort calls by date
    callsData.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Calculate call outcomes
    const callOutcomes = callsData.reduce((acc, call) => {
      acc[call.outcome] = (acc[call.outcome] || 0) + 1;
      return acc;
    }, {});
    
    res.json({
      campaignId: campaign._id,
      campaignName: campaign.name,
      totalLeads,
      leadsByStatus,
      conversionRate,
      qualificationRate,
      callsData: callsData.slice(0, 50), // Limit to last 50 calls
      callOutcomes
    });
  } catch (error) {
    console.error('Error in getCampaignAnalytics:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Start calling leads in a campaign
 * @route POST /api/campaigns/:id/start-calling
 * @access Private
 */
exports.startCalling = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    // Check if the campaign belongs to the user
    if (campaign.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to start calling for this campaign' });
    }
    
    // Check if campaign is active
    if (campaign.status !== 'active') {
      return res.status(400).json({ message: 'Campaign must be active to start calling' });
    }
    
    // Get script template
    const script = await ScriptTemplate.findById(campaign.scriptId);
    if (!script) {
      return res.status(400).json({ message: 'No script template found for this campaign' });
    }
    
    // Get voice
    const voice = await Voice.findById(campaign.voiceId);
    if (!voice) {
      return res.status(400).json({ message: 'No voice found for this campaign' });
    }
    
    // Get leads that haven't been called yet
    const leads = await Lead.find({
      campaign: req.params.id,
      status: 'new',
      phone: { $exists: true, $ne: '' }
    }).limit(req.body.maxCalls || 10);
    
    if (leads.length === 0) {
      return res.status(400).json({ message: 'No leads available to call' });
    }
    
    const callResults = [];
    const errors = [];
    
    // Add leads to calling queue
    const jobPromises = leads.map(async (lead, index) => {
      try {
        // Add delay between jobs to respect rate limiting
        const delay = index * 2000; // 2 seconds between each call
        
        const job = await callingQueue.add('call-lead', {
          leadId: lead._id,
          campaignId: campaign._id,
          retryCount: 0
        }, {
          delay,
          attempts: 2,
          backoff: {
            type: 'fixed',
            delay: 30000 // 30 second delay between retries
          }
        });
        
        callResults.push({
          leadId: lead._id,
          leadName: lead.businessName,
          jobId: job.id,
          status: 'queued',
          delay
        });
        
        logger.info(`Call job queued for lead ${lead.businessName}: ${job.id}`);
        return job;
      } catch (error) {
        logger.error(`Failed to queue call for lead ${lead.businessName}: ${error.message}`);
        errors.push({
          leadId: lead._id,
          leadName: lead.businessName,
          error: error.message
        });
        return null;
      }
    });
    
    await Promise.all(jobPromises);
    
    res.json({
      message: 'Calling started',
      totalLeads: leads.length,
      successfulCalls: callResults.length,
      failedCalls: errors.length,
      callResults,
      errors
    });
  } catch (error) {
    logger.error('Error in startCalling:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Call a specific lead
 * @route POST /api/campaigns/:id/call-lead/:leadId
 * @access Private
 */
exports.callLead = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    const lead = await Lead.findById(req.params.leadId);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }
    
    // Check if the campaign belongs to the user
    if (campaign.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to call leads for this campaign' });
    }
    
    // Check if lead belongs to campaign
    if (lead.campaign.toString() !== campaign._id.toString()) {
      return res.status(400).json({ message: 'Lead does not belong to this campaign' });
    }
    
    // Check if lead has a phone number
    if (!lead.phone) {
      return res.status(400).json({ message: 'Lead does not have a phone number' });
    }
    
    try {
      // Add lead to calling queue with high priority
      const job = await callingQueue.add('call-lead', {
        leadId: lead._id,
        campaignId: campaign._id,
        retryCount: 0,
        priority: true
      }, {
        priority: 1, // High priority for manual calls
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 30000
        }
      });
      
      res.json({
        message: 'Call queued successfully',
        jobId: job.id,
        lead: {
          id: lead._id,
          name: lead.businessName,
          phone: lead.phone
        },
        status: 'queued'
      });
    } catch (error) {
      logger.error(`Failed to initiate call for lead ${lead.businessName}: ${error.message}`);
      res.status(500).json({ 
        message: 'Failed to initiate call', 
        error: error.message 
      });
    }
  } catch (error) {
    logger.error('Error in callLead:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get active calls for a campaign
 * @route GET /api/campaigns/:id/active-calls
 * @access Private
 */
exports.getActiveCalls = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    // Check if the campaign belongs to the user
    if (campaign.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view calls for this campaign' });
    }
    
    // Get active calls from orchestrator
    const activeCalls = callOrchestrator.getActiveCalls()
      .filter(call => call.campaignId.toString() === campaign._id.toString())
      .map(call => ({
        callId: call.callId,
        leadName: call.lead.businessName,
        leadPhone: call.lead.phone,
        status: call.status,
        currentStage: call.currentStage,
        startTime: call.startTime,
        duration: call.startTime ? Math.floor((new Date() - call.startTime) / 1000) : 0
      }));
    
    res.json({
      campaignId: campaign._id,
      campaignName: campaign.name,
      activeCalls,
      totalActiveCalls: activeCalls.length
    });
  } catch (error) {
    logger.error('Error in getActiveCalls:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * End a specific call
 * @route POST /api/campaigns/:id/end-call/:callId
 * @access Private
 */
exports.endCall = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    // Check if the campaign belongs to the user
    if (campaign.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to end calls for this campaign' });
    }
    
    const callId = req.params.callId;
    
    try {
      const result = await callOrchestrator.forceEndCall(callId);
      
      res.json({
        message: 'Call ended successfully',
        callId: callId,
        summary: result
      });
    } catch (error) {
      logger.error(`Failed to end call ${callId}: ${error.message}`);
      res.status(500).json({ 
        message: 'Failed to end call', 
        error: error.message 
      });
    }
  } catch (error) {
    logger.error('Error in endCall:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
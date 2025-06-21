const Campaign = require('../models/Campaign');
const Lead = require('../models/Lead');
const User = require('../models/User');
const leadGenerationQueue = require('../workers/leadGenerationWorker');

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
    
    // Add job to lead generation queue
    const job = await leadGenerationQueue.add({
      campaignId: campaign._id,
      userId: req.user.id
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
const Lead = require('../models/Lead');
const Campaign = require('../models/Campaign');

/**
 * Get all leads for a user
 * @route GET /api/leads
 * @access Private
 */
exports.getLeads = async (req, res) => {
  try {
    const pageSize = Number(req.query.pageSize) || 10;
    const page = Number(req.query.page) || 1;
    const status = req.query.status;
    const campaign = req.query.campaign;
    
    const filterOptions = { user: req.user.id };
    
    if (status) filterOptions.status = status;
    if (campaign) filterOptions.campaign = campaign;
    
    const count = await Lead.countDocuments(filterOptions);
    
    const leads = await Lead.find(filterOptions)
      .populate('campaign', 'name')
      .sort({ createdAt: -1 })
      .limit(pageSize)
      .skip(pageSize * (page - 1));
    
    res.json({
      leads,
      page,
      pages: Math.ceil(count / pageSize),
      total: count
    });
  } catch (error) {
    console.error('Error in getLeads:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get a single lead by ID
 * @route GET /api/leads/:id
 * @access Private
 */
exports.getLeadById = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('campaign', 'name');
    
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }
    
    // Check if the lead belongs to the user
    if (lead.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to access this lead' });
    }
    
    res.json(lead);
  } catch (error) {
    console.error('Error in getLeadById:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Create a new lead
 * @route POST /api/leads
 * @access Private
 */
exports.createLead = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      company,
      position,
      linkedInUrl,
      website,
      industry,
      location,
      status,
      notes,
      source,
      tags,
      campaign
    } = req.body;
    
    // Check if campaign exists and belongs to user
    if (campaign) {
      const campaignExists = await Campaign.findOne({
        _id: campaign,
        user: req.user.id
      });
      
      if (!campaignExists) {
        return res.status(400).json({ message: 'Invalid campaign' });
      }
    }
    
    const lead = new Lead({
      user: req.user.id,
      firstName,
      lastName,
      email,
      phone,
      company,
      position,
      linkedInUrl,
      website,
      industry,
      location,
      status: status || 'new',
      notes,
      source: source || 'manual',
      tags,
      campaign
    });
    
    const createdLead = await lead.save();
    
    // Update campaign stats if lead is associated with a campaign
    if (campaign) {
      await Campaign.findByIdAndUpdate(campaign, {
        $inc: { leadsGenerated: 1 }
      });
    }
    
    res.status(201).json(createdLead);
  } catch (error) {
    console.error('Error in createLead:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Update a lead
 * @route PUT /api/leads/:id
 * @access Private
 */
exports.updateLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }
    
    // Check if the lead belongs to the user
    if (lead.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this lead' });
    }
    
    // Update lead fields
    Object.keys(req.body).forEach(key => {
      if (key !== 'user' && key !== '_id') {
        lead[key] = req.body[key];
      }
    });
    
    const updatedLead = await lead.save();
    
    res.json(updatedLead);
  } catch (error) {
    console.error('Error in updateLead:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Delete a lead
 * @route DELETE /api/leads/:id
 * @access Private
 */
exports.deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }
    
    // Check if the lead belongs to the user
    if (lead.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this lead' });
    }
    
    await lead.remove();
    
    res.json({ message: 'Lead removed' });
  } catch (error) {
    console.error('Error in deleteLead:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Add call history to a lead
 * @route POST /api/leads/:id/call
 * @access Private
 */
exports.addCallHistory = async (req, res) => {
  try {
    const { duration, notes, outcome } = req.body;
    
    const lead = await Lead.findById(req.params.id);
    
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }
    
    // Check if the lead belongs to the user
    if (lead.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this lead' });
    }
    
    const callRecord = {
      date: new Date(),
      duration,
      notes,
      outcome
    };
    
    lead.callHistory.push(callRecord);
    
    // Update lead status based on call outcome
    if (outcome === 'meeting scheduled') {
      lead.status = 'qualified';
    } else if (outcome === 'spoke') {
      lead.status = 'contacted';
    } else if (outcome === 'not interested') {
      lead.status = 'rejected';
    }
    
    // Update campaign stats if lead is associated with a campaign
    if (lead.campaign) {
      await Campaign.findByIdAndUpdate(lead.campaign, {
        $inc: { leadsContacted: 1 }
      });
      
      if (outcome === 'meeting scheduled') {
        await Campaign.findByIdAndUpdate(lead.campaign, {
          $inc: { leadsConverted: 1 }
        });
      }
    }
    
    const updatedLead = await lead.save();
    
    res.json(updatedLead);
  } catch (error) {
    console.error('Error in addCallHistory:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
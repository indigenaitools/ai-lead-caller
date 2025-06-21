const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  targetIndustry: {
    type: String,
    trim: true
  },
  targetLocation: {
    type: String,
    trim: true
  },
  targetPositions: [{
    type: String,
    trim: true
  }],
  targetCompanySize: {
    type: String,
    enum: ['small', 'medium', 'large', 'enterprise', 'any'],
    default: 'any'
  },
  searchCriteria: {
    type: Object
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'completed'],
    default: 'draft'
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  callScript: {
    type: String
  },
  leadsGenerated: {
    type: Number,
    default: 0
  },
  leadsContacted: {
    type: Number,
    default: 0
  },
  leadsConverted: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Campaign', CampaignSchema);
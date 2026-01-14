const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed'],
    default: 'active'
  },
  searchQuery: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  totalLeads: {
    type: Number,
    default: 0
  },
  calledLeads: {
    type: Number,
    default: 0
  },
  script: {
    type: String,
    trim: true
  },
  voiceId: {
    type: String,
    trim: true
  },
  settings: {
    maxLeads: {
      type: Number,
      default: 100
    },
    callDelay: {
      type: Number,
      default: 5 // seconds
    },
    maxRetries: {
      type: Number,
      default: 2
    }
  }
}, {
  timestamps: true // This automatically adds createdAt and updatedAt
});

// Create indexes for better performance
CampaignSchema.index({ userId: 1 });
CampaignSchema.index({ status: 1 });
CampaignSchema.index({ createdAt: 1 });
CampaignSchema.index({ updatedAt: 1 });
CampaignSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Campaign', CampaignSchema);
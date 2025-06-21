const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema({
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true
  },
  businessName: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  website: {
    type: String,
    trim: true
  },
  rating: {
    type: Number,
    min: 0,
    max: 5
  },
  status: {
    type: String,
    enum: ['new', 'called', 'interested', 'not-interested'],
    default: 'new'
  },
  callDuration: {
    type: Number,
    default: 0 // in seconds
  },
  callRecording: {
    type: String, // URL to recording
    default: null
  },
  transcript: {
    type: String,
    default: null
  },
  calledAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true // This automatically adds createdAt and updatedAt
});

// Create indexes for better performance
LeadSchema.index({ campaignId: 1 });
LeadSchema.index({ status: 1 });
LeadSchema.index({ businessName: 1 });
LeadSchema.index({ phone: 1 });
LeadSchema.index({ email: 1 });
LeadSchema.index({ createdAt: 1 });
LeadSchema.index({ calledAt: 1 });
LeadSchema.index({ campaignId: 1, status: 1 });

module.exports = mongoose.model('Lead', LeadSchema);
const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  campaign: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign'
  },
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  company: {
    type: String,
    trim: true
  },
  position: {
    type: String,
    trim: true
  },
  linkedInUrl: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  industry: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'qualified', 'converted', 'rejected'],
    default: 'new'
  },
  notes: {
    type: String
  },
  source: {
    type: String,
    enum: ['linkedin', 'website', 'manual', 'api', 'other'],
    default: 'manual'
  },
  callHistory: [{
    date: {
      type: Date,
      default: Date.now
    },
    duration: {
      type: Number
    },
    notes: {
      type: String
    },
    outcome: {
      type: String,
      enum: ['no answer', 'left message', 'spoke', 'meeting scheduled', 'not interested']
    }
  }],
  tags: [{
    type: String
  }],
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

module.exports = mongoose.model('Lead', LeadSchema);
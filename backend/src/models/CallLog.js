const mongoose = require('mongoose');

const CallLogSchema = new mongoose.Schema({
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    required: true
  },
  duration: {
    type: Number, // in seconds
    default: 0
  },
  cost: {
    type: Number, // in cents
    default: 0
  },
  recording: {
    type: String, // URL to recording
    default: null
  },
  transcript: {
    type: String,
    default: null
  },
  sentiment: {
    type: String,
    enum: ['positive', 'neutral', 'negative'],
    default: 'neutral'
  },
  outcome: {
    type: String,
    enum: ['no-answer', 'voicemail', 'connected', 'wrong-number', 'busy', 'failed'],
    default: 'no-answer'
  },
  notes: {
    type: String,
    default: ''
  },
  keyInsights: [{
    type: String
  }],
  nextSteps: {
    type: String,
    default: null
  }
}, {
  timestamps: true // This automatically adds createdAt and updatedAt
});

// Create indexes for better performance
CallLogSchema.index({ leadId: 1 });
CallLogSchema.index({ outcome: 1 });
CallLogSchema.index({ sentiment: 1 });
CallLogSchema.index({ createdAt: 1 });
CallLogSchema.index({ leadId: 1, outcome: 1 });
CallLogSchema.index({ leadId: 1, createdAt: 1 });

module.exports = mongoose.model('CallLog', CallLogSchema);
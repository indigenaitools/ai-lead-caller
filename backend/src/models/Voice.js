const mongoose = require('mongoose');

const VoiceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  provider: {
    type: String,
    enum: ['coqui', 'playht', 'elevenlabs', 'google', 'azure', 'amazon'],
    required: true
  },
  voiceId: {
    type: String,
    required: true,
    trim: true
  },
  language: {
    type: String,
    required: true,
    trim: true
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'neutral'],
    required: true
  },
  accent: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  sampleUrl: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  settings: {
    type: Map,
    of: String
  },
  usageCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Create indexes for better performance
VoiceSchema.index({ provider: 1 });
VoiceSchema.index({ language: 1 });
VoiceSchema.index({ gender: 1 });
VoiceSchema.index({ isActive: 1 });
VoiceSchema.index({ provider: 1, language: 1 });
VoiceSchema.index({ provider: 1, isActive: 1 });

// Static method to get active voices by provider
VoiceSchema.statics.getActiveVoicesByProvider = function(provider) {
  return this.find({ provider, isActive: true }).sort({ usageCount: -1 });
};

// Static method to get active voices by language
VoiceSchema.statics.getActiveVoicesByLanguage = function(language) {
  return this.find({ language, isActive: true }).sort({ usageCount: -1 });
};

// Static method to get recommended voices
VoiceSchema.statics.getRecommendedVoices = function(limit = 10) {
  return this.find({ isActive: true })
    .sort({ usageCount: -1 })
    .limit(limit);
};

// Method to increment usage count
VoiceSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  return this.save();
};

module.exports = mongoose.model('Voice', VoiceSchema);
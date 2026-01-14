const mongoose = require('mongoose');

const VoiceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  provider: {
    type: String,
    required: true,
    enum: ['coqui', 'playht', 'elevenlabs', 'azure', 'aws'],
    default: 'coqui'
  },
  voiceId: {
    type: String,
    required: true,
    trim: true
  },
  language: {
    type: String,
    required: true,
    default: 'en-US'
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'neutral'],
    required: true
  },
  accent: {
    type: String,
    trim: true,
    default: 'american'
  },
  ageRange: {
    type: String,
    enum: ['young', 'middle-aged', 'mature'],
    default: 'middle-aged'
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
  isPremium: {
    type: Boolean,
    default: false
  },
  costPerMinute: {
    type: Number,
    default: 0.01 // Cost in dollars per minute
  },
  tags: [{
    type: String,
    trim: true
  }],
  settings: {
    speed: {
      type: Number,
      min: 0.5,
      max: 2.0,
      default: 1.0
    },
    pitch: {
      type: Number,
      min: -20,
      max: 20,
      default: 0
    },
    volume: {
      type: Number,
      min: 0.1,
      max: 2.0,
      default: 1.0
    }
  },
  usage: {
    totalMinutes: {
      type: Number,
      default: 0
    },
    totalCalls: {
      type: Number,
      default: 0
    },
    lastUsed: {
      type: Date,
      default: null
    }
  }
}, {
  timestamps: true
});

// Create indexes for better performance
VoiceSchema.index({ provider: 1 });
VoiceSchema.index({ language: 1 });
VoiceSchema.index({ gender: 1 });
VoiceSchema.index({ isActive: 1 });
VoiceSchema.index({ isPremium: 1 });
VoiceSchema.index({ provider: 1, language: 1 });
VoiceSchema.index({ language: 1, gender: 1 });
VoiceSchema.index({ tags: 1 });

// Virtual for getting voice summary
VoiceSchema.virtual('summary').get(function() {
  return {
    name: this.name,
    provider: this.provider,
    language: this.language,
    gender: this.gender,
    accent: this.accent,
    isActive: this.isActive
  };
});

// Method to update usage statistics
VoiceSchema.methods.updateUsage = function(minutes) {
  this.usage.totalMinutes += minutes;
  this.usage.totalCalls += 1;
  this.usage.lastUsed = new Date();
  return this.save();
};

// Method to calculate cost for a given duration
VoiceSchema.methods.calculateCost = function(minutes) {
  return this.costPerMinute * minutes;
};

// Static method to get voices by criteria
VoiceSchema.statics.findByCriteria = function(criteria = {}) {
  const query = { isActive: true };
  
  if (criteria.language) {
    query.language = criteria.language;
  }
  
  if (criteria.gender) {
    query.gender = criteria.gender;
  }
  
  if (criteria.provider) {
    query.provider = criteria.provider;
  }
  
  if (criteria.accent) {
    query.accent = criteria.accent;
  }
  
  if (criteria.tags && criteria.tags.length > 0) {
    query.tags = { $in: criteria.tags };
  }
  
  if (criteria.premiumOnly) {
    query.isPremium = true;
  }
  
  return this.find(query).sort({ name: 1 });
};

// Static method to get default voices for each provider
VoiceSchema.statics.getDefaultVoices = function() {
  return [
    {
      name: 'Sarah - Professional Female',
      provider: 'coqui',
      voiceId: 'p225',
      language: 'en-US',
      gender: 'female',
      accent: 'american',
      description: 'Clear, professional female voice suitable for business calls',
      isActive: true,
      tags: ['professional', 'clear', 'business']
    },
    {
      name: 'David - Professional Male',
      provider: 'coqui',
      voiceId: 'p226',
      language: 'en-US',
      gender: 'male',
      accent: 'american',
      description: 'Confident, professional male voice for sales calls',
      isActive: true,
      tags: ['professional', 'confident', 'sales']
    },
    {
      name: 'Emma - Friendly Female',
      provider: 'playht',
      voiceId: 'en-US-EmmaNeural',
      language: 'en-US',
      gender: 'female',
      accent: 'american',
      description: 'Warm, friendly female voice for customer service',
      isActive: true,
      isPremium: true,
      costPerMinute: 0.02,
      tags: ['friendly', 'warm', 'customer-service']
    },
    {
      name: 'Ryan - Conversational Male',
      provider: 'playht',
      voiceId: 'en-US-RyanNeural',
      language: 'en-US',
      gender: 'male',
      accent: 'american',
      description: 'Natural, conversational male voice',
      isActive: true,
      isPremium: true,
      costPerMinute: 0.02,
      tags: ['conversational', 'natural', 'friendly']
    }
  ];
};

// Static method to seed default voices
VoiceSchema.statics.seedDefaultVoices = async function() {
  const existingCount = await this.countDocuments();
  
  if (existingCount === 0) {
    const defaultVoices = this.getDefaultVoices();
    await this.insertMany(defaultVoices);
    console.log('Default voices seeded successfully');
  }
};

module.exports = mongoose.model('Voice', VoiceSchema);
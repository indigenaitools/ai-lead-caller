const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  company: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'premium', 'enterprise'],
      default: 'free'
    },
    credits: {
      type: Number,
      default: 0
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    },
    stripeCustomerId: String,
    stripeSubscriptionId: String
  },
  apiKeys: {
    groq: {
      type: String,
      default: null
    },
    plivo: {
      type: String,
      default: null
    },
    elevenlabs: {
      type: String,
      default: null
    }
  }
}, {
  timestamps: true // This automatically adds createdAt and updatedAt
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Create indexes for better performance
UserSchema.index({ email: 1 });
UserSchema.index({ 'subscription.plan': 1 });
UserSchema.index({ 'subscription.expiresAt': 1 });
UserSchema.index({ createdAt: 1 });
UserSchema.index({ updatedAt: 1 });

module.exports = mongoose.model('User', UserSchema);
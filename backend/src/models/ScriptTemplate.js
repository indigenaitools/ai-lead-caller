const mongoose = require('mongoose');

const ScriptTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  industry: {
    type: String,
    required: true,
    trim: true
  },
  goal: {
    type: String,
    required: true,
    enum: [
      'lead_qualification',
      'appointment_setting',
      'product_demo',
      'sales_call',
      'survey',
      'follow_up',
      'customer_service'
    ]
  },
  introduction: {
    greeting: {
      type: String,
      required: true
    },
    companyIntro: {
      type: String,
      required: true
    },
    purposeStatement: {
      type: String,
      required: true
    },
    permissionToSpeak: {
      type: String,
      default: "Do you have a few minutes to chat?"
    }
  },
  questions: [{
    stage: {
      type: String,
      enum: ['qualification', 'discovery', 'needs_assessment', 'closing'],
      required: true
    },
    question: {
      type: String,
      required: true
    },
    followUpQuestions: [{
      type: String
    }],
    expectedAnswers: [{
      answer: String,
      nextAction: String
    }],
    priority: {
      type: Number,
      default: 1
    }
  }],
  objectionHandlers: {
    "not_interested": {
      responses: [{
        type: String,
        required: true
      }],
      followUp: String
    },
    "no_time": {
      responses: [{
        type: String,
        required: true
      }],
      followUp: String
    },
    "too_expensive": {
      responses: [{
        type: String,
        required: true
      }],
      followUp: String
    },
    "already_have_solution": {
      responses: [{
        type: String,
        required: true
      }],
      followUp: String
    },
    "need_to_think": {
      responses: [{
        type: String,
        required: true
      }],
      followUp: String
    },
    "call_back_later": {
      responses: [{
        type: String,
        required: true
      }],
      followUp: String
    },
    "not_decision_maker": {
      responses: [{
        type: String,
        required: true
      }],
      followUp: String
    }
  },
  closingStatements: {
    successful: {
      type: String,
      required: true
    },
    unsuccessful: {
      type: String,
      required: true
    },
    followUp: {
      type: String,
      required: true
    },
    voicemail: {
      type: String,
      required: true
    }
  },
  toneGuidelines: {
    personality: {
      type: String,
      enum: ['professional', 'friendly', 'casual', 'authoritative', 'consultative'],
      default: 'professional'
    },
    pace: {
      type: String,
      enum: ['slow', 'moderate', 'fast'],
      default: 'moderate'
    },
    enthusiasm: {
      type: String,
      enum: ['low', 'moderate', 'high'],
      default: 'moderate'
    }
  },
  complianceNotes: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  version: {
    type: Number,
    default: 1
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Create indexes for better performance
ScriptTemplateSchema.index({ industry: 1 });
ScriptTemplateSchema.index({ goal: 1 });
ScriptTemplateSchema.index({ createdBy: 1 });
ScriptTemplateSchema.index({ isActive: 1 });
ScriptTemplateSchema.index({ industry: 1, goal: 1 });
ScriptTemplateSchema.index({ tags: 1 });

// Virtual for getting the script summary
ScriptTemplateSchema.virtual('summary').get(function() {
  return {
    name: this.name,
    industry: this.industry,
    goal: this.goal,
    questionCount: this.questions.length,
    objectionCount: Object.keys(this.objectionHandlers).length,
    version: this.version
  };
});

// Method to get questions by stage
ScriptTemplateSchema.methods.getQuestionsByStage = function(stage) {
  return this.questions
    .filter(q => q.stage === stage)
    .sort((a, b) => a.priority - b.priority);
};

// Method to get objection response
ScriptTemplateSchema.methods.getObjectionResponse = function(objectionType) {
  const handler = this.objectionHandlers[objectionType];
  if (!handler || !handler.responses.length) {
    return null;
  }
  
  // Return a random response from the available options
  const randomIndex = Math.floor(Math.random() * handler.responses.length);
  return {
    response: handler.responses[randomIndex],
    followUp: handler.followUp
  };
};

// Method to validate script completeness
ScriptTemplateSchema.methods.validateCompleteness = function() {
  const errors = [];
  
  // Check required sections
  if (!this.introduction.greeting) {
    errors.push('Introduction greeting is required');
  }
  
  if (!this.introduction.companyIntro) {
    errors.push('Company introduction is required');
  }
  
  if (!this.introduction.purposeStatement) {
    errors.push('Purpose statement is required');
  }
  
  if (this.questions.length === 0) {
    errors.push('At least one question is required');
  }
  
  if (!this.closingStatements.successful) {
    errors.push('Successful closing statement is required');
  }
  
  if (!this.closingStatements.unsuccessful) {
    errors.push('Unsuccessful closing statement is required');
  }
  
  // Check objection handlers
  const requiredObjections = ['not_interested', 'no_time', 'too_expensive'];
  for (const objection of requiredObjections) {
    if (!this.objectionHandlers[objection] || 
        !this.objectionHandlers[objection].responses.length) {
      errors.push(`Objection handler for '${objection}' is required`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Static method to get default script template
ScriptTemplateSchema.statics.getDefaultTemplate = function(industry, goal) {
  const defaultTemplates = {
    'general': {
      'lead_qualification': {
        name: 'General Lead Qualification',
        introduction: {
          greeting: "Hi, this is [Agent Name] calling from [Company Name].",
          companyIntro: "We help businesses like yours improve their operations and increase efficiency.",
          purposeStatement: "I'm calling to see if you might be interested in learning more about our solutions.",
          permissionToSpeak: "Do you have a couple of minutes to chat?"
        },
        questions: [
          {
            stage: 'qualification',
            question: "What's your biggest challenge when it comes to [relevant area]?",
            priority: 1
          },
          {
            stage: 'qualification',
            question: "How are you currently handling [specific process]?",
            priority: 2
          }
        ],
        objectionHandlers: {
          "not_interested": {
            responses: [
              "I understand, and I appreciate your honesty. Can I ask what's working well for you currently?",
              "That's perfectly fine. Many of our best clients said the same thing initially. What if I could show you something in just 30 seconds?"
            ],
            followUp: "Would it be helpful if I sent you some information instead?"
          },
          "no_time": {
            responses: [
              "I completely understand how busy you must be. This will only take 2 minutes of your time.",
              "I appreciate that you're busy. When would be a better time for a quick 5-minute conversation?"
            ],
            followUp: "What's the best time to reach you this week?"
          }
        },
        closingStatements: {
          successful: "Great! I'll send you the information we discussed and follow up next week.",
          unsuccessful: "Thank you for your time today. I'll keep you in mind for future opportunities.",
          followUp: "I'll reach out again in a few months to see if anything has changed.",
          voicemail: "Hi, this is [Agent Name] from [Company Name]. I'll try calling back later."
        }
      }
    }
  };
  
  return defaultTemplates[industry] && defaultTemplates[industry][goal] 
    ? defaultTemplates[industry][goal] 
    : defaultTemplates['general']['lead_qualification'];
};

module.exports = mongoose.model('ScriptTemplate', ScriptTemplateSchema);
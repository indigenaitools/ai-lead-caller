#!/usr/bin/env node

const mongoose = require('mongoose');
const ScriptTemplate = require('../src/models/ScriptTemplate');
const Voice = require('../src/models/Voice');
require('dotenv').config();

/**
 * Seed default script templates and voices
 */
async function seedDefaults() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-lead-caller');
    console.log('Connected to MongoDB');

    // Default script templates
    const defaultScripts = [
      {
        name: 'General B2B Sales Script',
        description: 'A versatile script for general B2B sales calls',
        industry: 'General',
        introduction: {
          greeting: "Hi {firstName}, this is {agentName} from {companyName}. How are you doing today?",
          purpose: "I'm calling because we help businesses like {businessName} {valueProposition}. Do you have a quick minute to chat?",
          permission: "Great! I promise to keep this brief and valuable for you."
        },
        qualification: {
          questions: [
            "Can you tell me a bit about your current {industry} operations?",
            "What are your biggest challenges when it comes to {painPoint}?",
            "How are you currently handling {process}?",
            "What would an ideal solution look like for you?"
          ],
          painPoints: [
            "inefficient processes",
            "high costs",
            "time management",
            "customer acquisition"
          ]
        },
        presentation: {
          benefits: [
            "Increase efficiency by up to 40%",
            "Reduce operational costs",
            "Save time on manual processes",
            "Improve customer satisfaction"
          ],
          features: [
            "Automated workflow management",
            "Real-time analytics and reporting",
            "Integration with existing systems",
            "24/7 customer support"
          ]
        },
        objectionHandling: {
          "price": {
            response: "I understand cost is a concern. Let me ask you this - what's the cost of not solving this problem? Our solution typically pays for itself within 3 months through efficiency gains.",
            followUp: "Would you like to see a detailed ROI analysis based on your specific situation?"
          },
          "timing": {
            response: "I hear that a lot, and timing is important. But here's the thing - the longer you wait, the more money you're leaving on the table. What if we could show you results in just 30 days?",
            followUp: "What would need to happen for the timing to be right?"
          },
          "decision_maker": {
            response: "I appreciate you being upfront about that. Who else would be involved in this decision?",
            followUp: "Would it make sense to include them in our next conversation so everyone's on the same page?"
          },
          "competition": {
            response: "That's great that you're exploring options. What specifically drew you to them?",
            followUp: "Based on what you've told me about your needs, here's how we're different..."
          }
        },
        closing: {
          trial: "Based on our conversation, I think our solution could be a great fit. Would you be open to a 14-day free trial to see the results firsthand?",
          demo: "I'd love to show you exactly how this would work for {businessName}. Are you available for a 15-minute demo this week?",
          meeting: "Let's schedule a brief meeting where I can show you some case studies from similar companies. What does your calendar look like?"
        },
        followUp: {
          immediate: "I'll send you an email with the information we discussed right after this call.",
          scheduled: "I'll follow up with you {timeframe} as we discussed.",
          resources: "I'm also including some case studies and ROI calculators that might be helpful."
        },
        isPublic: true
      },
      {
        name: 'SaaS Sales Script',
        description: 'Specialized script for SaaS product sales',
        industry: 'Technology',
        introduction: {
          greeting: "Hi {firstName}, this is {agentName} from {companyName}. I hope I'm catching you at a good time.",
          purpose: "I'm reaching out because I noticed {businessName} might benefit from our {productType} solution. We've helped similar companies {achievement}.",
          permission: "Would you have 3-4 minutes for me to share how we might be able to help you too?"
        },
        qualification: {
          questions: [
            "What software are you currently using for {useCase}?",
            "How many team members would be using this type of solution?",
            "What's working well with your current setup, and what isn't?",
            "If you could wave a magic wand and fix one thing about your current process, what would it be?"
          ],
          painPoints: [
            "manual data entry",
            "lack of integration",
            "poor user experience",
            "scalability issues"
          ]
        },
        presentation: {
          benefits: [
            "Reduce manual work by 60%",
            "Seamless integration with existing tools",
            "Intuitive user interface",
            "Scales with your business growth"
          ],
          features: [
            "API integrations",
            "Custom dashboards",
            "Advanced analytics",
            "Mobile accessibility"
          ]
        },
        objectionHandling: {
          "price": {
            response: "I understand budget is important. Our customers typically see ROI within 60 days. What's your current cost for {currentSolution}?",
            followUp: "Let me show you how our pricing compares when you factor in the time savings and efficiency gains."
          },
          "complexity": {
            response: "That's exactly why we built this to be user-friendly. Most teams are up and running in under 24 hours.",
            followUp: "We also provide full onboarding support and training. Would you like to see how simple the setup process is?"
          }
        },
        closing: {
          trial: "We offer a 30-day free trial with full access to all features. Would you like to get that started today?",
          demo: "I'd love to show you a personalized demo based on your specific use case. When would be a good time this week?"
        },
        followUp: {
          immediate: "I'll send you the trial link and setup guide right after our call.",
          scheduled: "I'll check in with you next week to see how the trial is going."
        },
        isPublic: true
      }
    ];

    // Default voices
    const defaultVoices = [
      {
        name: 'Professional Male - David',
        description: 'Clear, professional male voice suitable for business calls',
        provider: 'playht',
        voiceId: 'david_professional',
        language: 'en-US',
        gender: 'male',
        accent: 'american',
        settings: {
          speed: 1.0,
          pitch: 0.0,
          volume: 0.8,
          stability: 0.75,
          clarity: 0.85
        },
        isPublic: true
      },
      {
        name: 'Professional Female - Sarah',
        description: 'Warm, professional female voice perfect for sales calls',
        provider: 'playht',
        voiceId: 'sarah_professional',
        language: 'en-US',
        gender: 'female',
        accent: 'american',
        settings: {
          speed: 1.0,
          pitch: 0.1,
          volume: 0.8,
          stability: 0.8,
          clarity: 0.9
        },
        isPublic: true
      },
      {
        name: 'Friendly Male - Mike',
        description: 'Friendly, approachable male voice for casual conversations',
        provider: 'playht',
        voiceId: 'mike_friendly',
        language: 'en-US',
        gender: 'male',
        accent: 'american',
        settings: {
          speed: 0.95,
          pitch: 0.05,
          volume: 0.85,
          stability: 0.7,
          clarity: 0.8
        },
        isPublic: true
      },
      {
        name: 'Executive Female - Victoria',
        description: 'Authoritative, executive-level female voice',
        provider: 'playht',
        voiceId: 'victoria_executive',
        language: 'en-US',
        gender: 'female',
        accent: 'american',
        settings: {
          speed: 0.9,
          pitch: -0.05,
          volume: 0.9,
          stability: 0.85,
          clarity: 0.95
        },
        isPublic: true
      }
    ];

    // Clear existing public templates and voices
    await ScriptTemplate.deleteMany({ isPublic: true });
    await Voice.deleteMany({ isPublic: true });
    console.log('Cleared existing public templates and voices');

    // Insert default script templates
    const insertedScripts = await ScriptTemplate.insertMany(defaultScripts);
    console.log(`Inserted ${insertedScripts.length} default script templates`);

    // Insert default voices
    const insertedVoices = await Voice.insertMany(defaultVoices);
    console.log(`Inserted ${insertedVoices.length} default voices`);

    console.log('✅ Default data seeded successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding default data:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run if called directly
if (require.main === module) {
  seedDefaults();
}

module.exports = { seedDefaults };
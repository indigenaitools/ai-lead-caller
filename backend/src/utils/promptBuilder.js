const logger = require('./logger');

/**
 * Prompt building utilities for AI conversations
 */
class PromptBuilder {
  /**
   * Build a comprehensive system prompt for the AI agent
   * @param {object} campaign - Campaign information with script
   * @param {object} lead - Lead information
   * @returns {string} - Complete system prompt
   */
  static buildSystemPrompt(campaign, lead) {
    const script = campaign.script;
    
    const systemPrompt = `
You are an AI sales representative making a cold call. Your goal is to have a natural, professional conversation while following the provided script guidelines.

## LEAD INFORMATION:
- Business Name: ${lead.businessName || 'Unknown'}
- Phone: ${lead.phone || 'Unknown'}
- Address: ${lead.address || 'Unknown'}
- Website: ${lead.website || 'Unknown'}
- Rating: ${lead.rating || 'Unknown'}

## SCRIPT INFORMATION:
- Industry: ${script.industry}
- Goal: ${script.goal}
- Tone: ${script.toneGuidelines?.personality || 'professional'}
- Pace: ${script.toneGuidelines?.pace || 'moderate'}

## INTRODUCTION GUIDELINES:
${script.introduction ? `
- Greeting: ${script.introduction.greeting}
- Company Introduction: ${script.introduction.companyIntro}
- Purpose: ${script.introduction.purposeStatement}
- Permission: ${script.introduction.permissionToSpeak}
` : ''}

## KEY QUESTIONS TO ASK:
${script.questions ? script.questions.map((q, index) => 
  `${index + 1}. [${q.stage.toUpperCase()}] ${q.question}`
).join('\n') : 'No specific questions provided.'}

## OBJECTION HANDLING:
${script.objectionHandlers ? Object.entries(script.objectionHandlers).map(([objection, handler]) => 
  `- ${objection.replace('_', ' ').toUpperCase()}: ${handler.responses[0] || 'Handle professionally'}`
).join('\n') : 'Handle objections professionally and empathetically.'}

## CLOSING STATEMENTS:
${script.closingStatements ? `
- Successful: ${script.closingStatements.successful}
- Unsuccessful: ${script.closingStatements.unsuccessful}
- Follow-up: ${script.closingStatements.followUp}
` : ''}

## CONVERSATION RULES:
1. Always be polite, professional, and respectful
2. Listen actively to the prospect's responses
3. Adapt your approach based on their reactions
4. Keep responses concise (under 100 words)
5. Ask one question at a time
6. Use the prospect's business name when appropriate
7. If they seem uninterested, try to understand why before giving up
8. Always respect their time and decision
9. Maintain a conversational tone, not robotic
10. Use natural speech patterns and occasional filler words for authenticity

## COMPLIANCE NOTES:
${script.complianceNotes || 'Follow all applicable telemarketing and privacy regulations.'}

## RESPONSE FORMAT:
Respond as if you're speaking directly to the prospect. Do not include stage directions, internal thoughts, or meta-commentary. Just provide the natural speech response.

Remember: You're having a real conversation with a real person. Be human, be helpful, and be respectful.
`;

    return systemPrompt.trim();
  }

  /**
   * Format conversation history for context
   * @param {Array} messages - Array of conversation messages
   * @returns {string} - Formatted conversation history
   */
  static formatConversationHistory(messages) {
    if (!messages || messages.length === 0) {
      return 'No previous conversation.';
    }

    return messages
      .map(msg => {
        const timestamp = msg.timestamp ? 
          new Date(msg.timestamp).toLocaleTimeString() : '';
        const role = msg.role === 'assistant' ? 'Agent' : 'Prospect';
        const stage = msg.stage ? ` [${msg.stage}]` : '';
        
        return `${timestamp} ${role}${stage}: ${msg.content}`;
      })
      .join('\n');
  }

  /**
   * Extract action items and key insights from conversation transcript
   * @param {string} transcript - Full conversation transcript
   * @returns {object} - Extracted action items and insights
   */
  static extractActionItems(transcript) {
    if (!transcript) {
      return {
        actionItems: [],
        keyInsights: [],
        nextSteps: [],
        sentiment: 'neutral'
      };
    }

    // Simple keyword-based extraction (in a real implementation, you'd use NLP)
    const actionKeywords = [
      'follow up', 'call back', 'send information', 'schedule', 'meeting',
      'demo', 'proposal', 'quote', 'contact', 'email', 'appointment'
    ];

    const insightKeywords = [
      'budget', 'timeline', 'decision maker', 'current solution', 'pain point',
      'challenge', 'priority', 'interested', 'not interested', 'competitor'
    ];

    const actionItems = [];
    const keyInsights = [];
    const nextSteps = [];

    // Extract sentences containing action keywords
    const sentences = transcript.split(/[.!?]+/);
    
    sentences.forEach(sentence => {
      const lowerSentence = sentence.toLowerCase();
      
      // Check for action items
      actionKeywords.forEach(keyword => {
        if (lowerSentence.includes(keyword)) {
          actionItems.push(sentence.trim());
        }
      });
      
      // Check for insights
      insightKeywords.forEach(keyword => {
        if (lowerSentence.includes(keyword)) {
          keyInsights.push(sentence.trim());
        }
      });
    });

    // Determine overall sentiment
    const positiveWords = ['interested', 'yes', 'good', 'great', 'perfect', 'sounds good'];
    const negativeWords = ['not interested', 'no', 'busy', 'not now', 'maybe later'];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    const lowerTranscript = transcript.toLowerCase();
    positiveWords.forEach(word => {
      if (lowerTranscript.includes(word)) positiveCount++;
    });
    negativeWords.forEach(word => {
      if (lowerTranscript.includes(word)) negativeCount++;
    });

    let sentiment = 'neutral';
    if (positiveCount > negativeCount) {
      sentiment = 'positive';
    } else if (negativeCount > positiveCount) {
      sentiment = 'negative';
    }

    // Generate next steps based on content
    if (lowerTranscript.includes('call back') || lowerTranscript.includes('follow up')) {
      nextSteps.push('Schedule follow-up call');
    }
    if (lowerTranscript.includes('send information') || lowerTranscript.includes('email')) {
      nextSteps.push('Send requested information via email');
    }
    if (lowerTranscript.includes('not interested')) {
      nextSteps.push('Mark as not interested, follow up in 6 months');
    }
    if (lowerTranscript.includes('demo') || lowerTranscript.includes('meeting')) {
      nextSteps.push('Schedule product demonstration');
    }

    return {
      actionItems: [...new Set(actionItems)], // Remove duplicates
      keyInsights: [...new Set(keyInsights)],
      nextSteps: [...new Set(nextSteps)],
      sentiment,
      summary: this.generateCallSummary(transcript, sentiment)
    };
  }

  /**
   * Generate a brief call summary
   * @param {string} transcript - Full conversation transcript
   * @param {string} sentiment - Overall sentiment
   * @returns {string} - Brief call summary
   * @private
   */
  static generateCallSummary(transcript, sentiment) {
    const wordCount = transcript.split(' ').length;
    const duration = Math.ceil(wordCount / 150); // Approximate minutes based on speaking rate
    
    let outcome = 'Conversation completed';
    const lowerTranscript = transcript.toLowerCase();
    
    if (lowerTranscript.includes('interested') && !lowerTranscript.includes('not interested')) {
      outcome = 'Prospect showed interest';
    } else if (lowerTranscript.includes('not interested')) {
      outcome = 'Prospect not interested at this time';
    } else if (lowerTranscript.includes('call back') || lowerTranscript.includes('follow up')) {
      outcome = 'Follow-up scheduled';
    } else if (lowerTranscript.includes('demo') || lowerTranscript.includes('meeting')) {
      outcome = 'Meeting/demo scheduled';
    }

    return `${outcome}. Call duration: ~${duration} minutes. Sentiment: ${sentiment}.`;
  }

  /**
   * Build a prompt for intent analysis
   * @param {string} userResponse - User's response to analyze
   * @param {object} context - Current conversation context
   * @returns {string} - Intent analysis prompt
   */
  static buildIntentAnalysisPrompt(userResponse, context) {
    return `
Analyze the following user response in the context of a sales call and determine their intent.

User Response: "${userResponse}"

Current Stage: ${context.currentStage || 'unknown'}
Previous Responses: ${context.previousResponses || 'none'}

Classify the intent as one of:
- interested: Shows genuine interest in learning more
- not_interested: Clearly not interested in the offering
- needs_info: Wants more information before deciding
- objection: Has specific concerns or objections
- ready_to_buy: Ready to move forward with purchase/next step
- callback_request: Wants to be contacted at a different time
- hang_up: Wants to end the conversation

Also determine:
- Sentiment: positive, neutral, or negative
- Confidence: 0.0 to 1.0
- Key points mentioned
- Suggested next action

Respond in JSON format:
{
  "intent": "intent_category",
  "confidence": 0.0-1.0,
  "sentiment": "positive/neutral/negative",
  "key_points": ["point1", "point2"],
  "next_action": "suggested_action"
}
`;
  }

  /**
   * Build a prompt for generating follow-up questions
   * @param {object} lead - Lead information
   * @param {string} previousResponse - Lead's previous response
   * @param {string} stage - Current conversation stage
   * @returns {string} - Follow-up question prompt
   */
  static buildFollowUpPrompt(lead, previousResponse, stage) {
    return `
Based on the lead's response, generate an appropriate follow-up question.

Lead Information:
- Business: ${lead.businessName}
- Industry: ${lead.industry || 'Unknown'}

Previous Response: "${previousResponse}"
Current Stage: ${stage}

Generate a natural, conversational follow-up question that:
1. Acknowledges their response
2. Digs deeper into their needs or concerns
3. Moves the conversation forward
4. Feels natural and not scripted

Respond with just the question, no additional formatting.
`;
  }
}

module.exports = PromptBuilder;
const axios = require('axios');
const logger = require('../utils/logger');
const promptBuilder = require('../utils/promptBuilder');

/**
 * Groq API client for AI conversation management
 */
class GroqClient {
  constructor() {
    this.apiKey = null;
    this.baseURL = 'https://api.groq.com/openai/v1';
    this.model = 'llama-3.1-70b-versatile';
    this.maxTokens = 1024;
    this.temperature = 0.7;
  }

  /**
   * Initialize the Groq client with API key
   * @param {string} apiKey - Groq API key
   */
  initialize(apiKey) {
    if (!apiKey) {
      throw new Error('Groq API key is required');
    }
    this.apiKey = apiKey;
    logger.info('Groq client initialized successfully');
  }

  /**
   * Generate AI response based on context and user input
   * @param {object} context - Conversation context
   * @param {string} userInput - User's input/response
   * @returns {Promise<object>} - AI response with text and metadata
   */
  async generateResponse(context, userInput) {
    if (!this.apiKey) {
      throw new Error('Groq client not initialized. Call initialize() first.');
    }

    try {
      const messages = [
        {
          role: 'system',
          content: context.systemPrompt
        },
        ...context.conversationHistory,
        {
          role: 'user',
          content: userInput
        }
      ];

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages: messages,
          max_tokens: this.maxTokens,
          temperature: this.temperature,
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const aiResponse = response.data.choices[0].message.content;
      const usage = response.data.usage;

      logger.debug(`AI response generated. Tokens used: ${usage.total_tokens}`);

      return {
        text: aiResponse,
        usage: usage,
        model: this.model
      };
    } catch (error) {
      logger.error(`Error generating AI response: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analyze user intent from their response
   * @param {string} userResponse - User's response
   * @param {object} context - Current conversation context
   * @returns {Promise<object>} - Intent analysis result
   */
  async analyzeIntent(userResponse, context) {
    try {
      const intentPrompt = `
Analyze the following user response and determine their intent. Respond with a JSON object containing:
- intent: one of ["interested", "not_interested", "needs_info", "objection", "ready_to_buy", "callback_request", "hang_up"]
- confidence: number between 0-1
- sentiment: one of ["positive", "neutral", "negative"]
- key_points: array of important points mentioned
- next_action: suggested next action for the conversation

User response: "${userResponse}"

Context: ${context.currentStage || 'introduction'}
`;

      const response = await this.generateResponse(
        {
          systemPrompt: intentPrompt,
          conversationHistory: []
        },
        userResponse
      );

      // Parse the JSON response
      const intentData = JSON.parse(response.text);
      
      return intentData;
    } catch (error) {
      logger.error(`Error analyzing intent: ${error.message}`);
      
      // Return default intent if parsing fails
      return {
        intent: 'needs_info',
        confidence: 0.5,
        sentiment: 'neutral',
        key_points: [],
        next_action: 'continue_conversation'
      };
    }
  }
}

/**
 * Conversation flow manager for handling call progression
 */
class ConversationFlow {
  constructor(groqClient) {
    this.groqClient = groqClient;
    this.conversationHistory = [];
    this.currentStage = 'introduction';
    this.lead = null;
    this.script = null;
    this.callStartTime = null;
    this.maxCallDuration = 600; // 10 minutes in seconds
    this.stages = [
      'introduction',
      'qualification',
      'presentation',
      'objection_handling',
      'closing',
      'follow_up'
    ];
  }

  /**
   * Start a new call with a lead
   * @param {object} lead - Lead information
   * @param {object} script - Script template to use
   * @returns {Promise<object>} - Initial conversation state
   */
  async startCall(lead, script) {
    this.lead = lead;
    this.script = script;
    this.callStartTime = new Date();
    this.currentStage = 'introduction';
    this.conversationHistory = [];

    logger.info(`Starting call with ${lead.businessName}`);

    // Build system prompt
    const systemPrompt = promptBuilder.buildSystemPrompt(
      { script: this.script },
      this.lead
    );

    // Generate opening message
    const context = {
      systemPrompt,
      conversationHistory: this.conversationHistory,
      currentStage: this.currentStage
    };

    const openingResponse = await this.groqClient.generateResponse(
      context,
      `Start the conversation with the introduction from the script.`
    );

    // Add to conversation history
    this.conversationHistory.push({
      role: 'assistant',
      content: openingResponse.text,
      timestamp: new Date(),
      stage: this.currentStage
    });

    return {
      response: openingResponse.text,
      stage: this.currentStage,
      shouldContinue: true
    };
  }

  /**
   * Process user response and generate next AI response
   * @param {string} transcript - User's spoken response (from speech-to-text)
   * @returns {Promise<object>} - Next conversation state
   */
  async processUserResponse(transcript) {
    if (!transcript || transcript.trim().length === 0) {
      return this.handleSilence();
    }

    logger.debug(`Processing user response: ${transcript}`);

    // Add user response to history
    this.conversationHistory.push({
      role: 'user',
      content: transcript,
      timestamp: new Date(),
      stage: this.currentStage
    });

    // Analyze user intent
    const intentAnalysis = await this.determineIntent(transcript);

    // Update conversation stage based on intent
    this.updateStage(intentAnalysis);

    // Generate next response
    const nextResponse = await this.getNextResponse(transcript, intentAnalysis);

    // Add AI response to history
    this.conversationHistory.push({
      role: 'assistant',
      content: nextResponse,
      timestamp: new Date(),
      stage: this.currentStage,
      intent: intentAnalysis
    });

    // Check if call should end
    const shouldEnd = this.shouldEndCall(intentAnalysis);

    return {
      response: nextResponse,
      stage: this.currentStage,
      intent: intentAnalysis,
      shouldContinue: !shouldEnd,
      conversationHistory: this.conversationHistory
    };
  }

  /**
   * Determine user intent from their response
   * @param {string} response - User's response
   * @returns {Promise<object>} - Intent analysis
   */
  async determineIntent(response) {
    const context = {
      currentStage: this.currentStage,
      lead: this.lead,
      script: this.script
    };

    return await this.groqClient.analyzeIntent(response, context);
  }

  /**
   * Generate the next AI response based on user input and intent
   * @param {string} userInput - User's input
   * @param {object} intentAnalysis - Analyzed intent
   * @returns {Promise<string>} - Next AI response
   */
  async getNextResponse(userInput, intentAnalysis) {
    const systemPrompt = promptBuilder.buildSystemPrompt(
      { script: this.script },
      this.lead
    );

    const conversationContext = promptBuilder.formatConversationHistory(
      this.conversationHistory
    );

    const contextualPrompt = `
${systemPrompt}

Current conversation stage: ${this.currentStage}
User intent: ${intentAnalysis.intent}
User sentiment: ${intentAnalysis.sentiment}

Conversation history:
${conversationContext}

Based on the user's response and intent, provide an appropriate response that:
1. Addresses their specific concern or question
2. Moves the conversation forward toward the goal
3. Maintains a professional and friendly tone
4. Uses the script guidelines but adapts to the conversation flow
5. Keeps responses concise (under 100 words)

User's latest response: "${userInput}"
`;

    const context = {
      systemPrompt: contextualPrompt,
      conversationHistory: [],
      currentStage: this.currentStage
    };

    const response = await this.groqClient.generateResponse(context, userInput);
    return response.text;
  }

  /**
   * Update conversation stage based on intent analysis
   * @param {object} intentAnalysis - Intent analysis result
   * @private
   */
  updateStage(intentAnalysis) {
    const { intent, next_action } = intentAnalysis;

    // Stage progression logic
    switch (this.currentStage) {
      case 'introduction':
        if (intent === 'interested' || intent === 'needs_info') {
          this.currentStage = 'qualification';
        } else if (intent === 'not_interested' || intent === 'hang_up') {
          this.currentStage = 'closing';
        }
        break;

      case 'qualification':
        if (intent === 'interested') {
          this.currentStage = 'presentation';
        } else if (intent === 'objection') {
          this.currentStage = 'objection_handling';
        } else if (intent === 'not_interested') {
          this.currentStage = 'closing';
        }
        break;

      case 'presentation':
        if (intent === 'ready_to_buy' || intent === 'interested') {
          this.currentStage = 'closing';
        } else if (intent === 'objection') {
          this.currentStage = 'objection_handling';
        }
        break;

      case 'objection_handling':
        if (intent === 'interested') {
          this.currentStage = 'presentation';
        } else if (intent === 'ready_to_buy') {
          this.currentStage = 'closing';
        } else if (intent === 'not_interested') {
          this.currentStage = 'closing';
        }
        break;

      case 'closing':
        if (intent === 'callback_request') {
          this.currentStage = 'follow_up';
        }
        break;
    }

    logger.debug(`Stage updated to: ${this.currentStage}`);
  }

  /**
   * Handle silence or no response from user
   * @returns {object} - Response for handling silence
   * @private
   */
  handleSilence() {
    const silenceResponses = [
      "Hello? Are you still there?",
      "I'm sorry, I didn't catch that. Could you please respond?",
      "Are you able to hear me clearly?"
    ];

    const response = silenceResponses[Math.floor(Math.random() * silenceResponses.length)];

    this.conversationHistory.push({
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      stage: this.currentStage,
      type: 'silence_handler'
    });

    return {
      response,
      stage: this.currentStage,
      shouldContinue: true,
      type: 'silence_handler'
    };
  }

  /**
   * Determine if the call should end
   * @param {object} intentAnalysis - Intent analysis result
   * @returns {boolean} - True if call should end
   */
  shouldEndCall(intentAnalysis) {
    // End call conditions
    const endIntents = ['hang_up', 'not_interested'];
    const callDuration = (new Date() - this.callStartTime) / 1000;

    // End if user wants to hang up or is not interested
    if (endIntents.includes(intentAnalysis.intent)) {
      logger.info('Ending call due to user intent');
      return true;
    }

    // End if call has gone on too long
    if (callDuration > this.maxCallDuration) {
      logger.info('Ending call due to time limit');
      return true;
    }

    // End if we've reached the final stage and completed the goal
    if (this.currentStage === 'follow_up') {
      logger.info('Ending call - follow-up stage completed');
      return true;
    }

    // End if too many negative responses
    const recentResponses = this.conversationHistory.slice(-5);
    const negativeCount = recentResponses.filter(
      msg => msg.intent && msg.intent.sentiment === 'negative'
    ).length;

    if (negativeCount >= 3) {
      logger.info('Ending call due to repeated negative responses');
      return true;
    }

    return false;
  }

  /**
   * Get conversation summary and action items
   * @returns {object} - Call summary with action items
   */
  getCallSummary() {
    const callDuration = (new Date() - this.callStartTime) / 1000;
    const transcript = this.conversationHistory
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const actionItems = promptBuilder.extractActionItems(transcript);

    return {
      lead: this.lead,
      duration: Math.round(callDuration),
      finalStage: this.currentStage,
      conversationHistory: this.conversationHistory,
      actionItems,
      transcript
    };
  }
}

/**
 * Main AI service class
 */
class AIService {
  constructor() {
    this.groqClient = new GroqClient();
    this.activeConversations = new Map();
  }

  /**
   * Initialize the AI service with API key
   * @param {string} apiKey - Groq API key
   */
  initialize(apiKey) {
    this.groqClient.initialize(apiKey);
  }

  /**
   * Start a new conversation
   * @param {string} conversationId - Unique conversation ID
   * @param {object} lead - Lead information
   * @param {object} script - Script template
   * @returns {Promise<object>} - Initial conversation state
   */
  async startConversation(conversationId, lead, script) {
    const conversation = new ConversationFlow(this.groqClient);
    this.activeConversations.set(conversationId, conversation);

    return await conversation.startCall(lead, script);
  }

  /**
   * Process user response in an active conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} transcript - User's response
   * @returns {Promise<object>} - Next conversation state
   */
  async processResponse(conversationId, transcript) {
    const conversation = this.activeConversations.get(conversationId);
    
    if (!conversation) {
      throw new Error(`No active conversation found for ID: ${conversationId}`);
    }

    const result = await conversation.processUserResponse(transcript);

    // If conversation should end, remove it from active conversations
    if (!result.shouldContinue) {
      this.activeConversations.delete(conversationId);
    }

    return result;
  }

  /**
   * End a conversation and get summary
   * @param {string} conversationId - Conversation ID
   * @returns {object} - Call summary
   */
  endConversation(conversationId) {
    const conversation = this.activeConversations.get(conversationId);
    
    if (!conversation) {
      throw new Error(`No active conversation found for ID: ${conversationId}`);
    }

    const summary = conversation.getCallSummary();
    this.activeConversations.delete(conversationId);

    return summary;
  }

  /**
   * Get active conversation count
   * @returns {number} - Number of active conversations
   */
  getActiveConversationCount() {
    return this.activeConversations.size;
  }
}

module.exports = new AIService();
const EventEmitter = require('events');
const logger = require('../utils/logger');
const callingService = require('./calling.service');
const aiService = require('./ai.service');
const ttsService = require('./tts.service');
const Lead = require('../models/Lead');
const Campaign = require('../models/Campaign');
const ScriptTemplate = require('../models/ScriptTemplate');
const Voice = require('../models/Voice');

/**
 * Call orchestrator for managing the entire call lifecycle
 */
class CallOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.activeCalls = new Map();
    this.callLeadMapping = new Map();
    this.callCampaignMapping = new Map();
  }

  /**
   * Initiate a call to a lead
   * @param {object} lead - Lead object
   * @param {object} campaign - Campaign object
   * @param {object} options - Call options
   * @returns {Promise<object>} - Call initiation result
   */
  async initiateCall(lead, campaign, options = {}) {
    try {
      logger.info(`Initiating call to ${lead.businessName} (${lead.phone})`);

      // Get script template for the campaign
      const script = await ScriptTemplate.findById(campaign.scriptId || null);
      if (!script) {
        throw new Error('No script template found for campaign');
      }

      // Get voice for the campaign
      const voice = await Voice.findById(campaign.voiceId || null);
      if (!voice) {
        throw new Error('No voice found for campaign');
      }

      // Prepare webhook URL
      const webhookUrl = `${process.env.BASE_URL}/webhooks/plivo`;

      // Get campaign phone number (should be owned by the account)
      const fromNumber = campaign.phoneNumber || process.env.DEFAULT_PHONE_NUMBER;
      if (!fromNumber) {
        throw new Error('No phone number available for making calls');
      }

      // Make the call
      const callResult = await callingService.makeCall(
        lead.phone,
        fromNumber,
        webhookUrl,
        {
          callerName: campaign.callerName || 'AI Assistant',
          ...options
        }
      );

      // Store call information
      const callData = {
        callId: callResult.callId,
        leadId: lead._id,
        campaignId: campaign._id,
        lead: lead,
        campaign: campaign,
        script: script,
        voice: voice,
        status: 'initiated',
        startTime: new Date(),
        conversationHistory: [],
        currentStage: 'introduction'
      };

      this.activeCalls.set(callResult.callId, callData);
      this.callLeadMapping.set(callResult.callId, lead);
      this.callCampaignMapping.set(callResult.callId, campaign);

      // Initialize AI conversation
      await aiService.startConversation(callResult.callId, lead, script);

      // Emit call initiated event
      this.emit('callInitiated', {
        callId: callResult.callId,
        lead: lead,
        campaign: campaign
      });

      logger.info(`Call initiated successfully: ${callResult.callId}`);

      return {
        success: true,
        callId: callResult.callId,
        status: 'initiated',
        lead: lead.businessName,
        phone: lead.phone
      };
    } catch (error) {
      logger.error(`Error initiating call to ${lead.businessName}: ${error.message}`);
      
      // Emit call failed event
      this.emit('callFailed', {
        lead: lead,
        campaign: campaign,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Start conversation when call is answered
   * @param {string} callId - Call UUID
   * @returns {Promise<string>} - Initial conversation message
   */
  async startConversation(callId) {
    try {
      const callData = this.activeCalls.get(callId);
      if (!callData) {
        throw new Error(`No call data found for ${callId}`);
      }

      logger.info(`Starting conversation for call ${callId}`);

      // Get initial AI response
      const conversationState = await aiService.startConversation(
        callId,
        callData.lead,
        callData.script
      );

      // Update call data
      callData.status = 'conversation_started';
      callData.conversationHistory.push({
        role: 'assistant',
        content: conversationState.response,
        timestamp: new Date()
      });

      // Emit conversation started event
      this.emit('conversationStarted', {
        callId: callId,
        lead: callData.lead,
        initialMessage: conversationState.response
      });

      return conversationState.response;
    } catch (error) {
      logger.error(`Error starting conversation for call ${callId}: ${error.message}`);
      return "Hello, thank you for taking my call. I'll keep this brief.";
    }
  }

  /**
   * Process user input during the call
   * @param {string} callId - Call UUID
   * @param {string} userInput - User's spoken input
   * @returns {Promise<object>} - AI response and conversation state
   */
  async processUserInput(callId, userInput) {
    try {
      const callData = this.activeCalls.get(callId);
      if (!callData) {
        throw new Error(`No call data found for ${callId}`);
      }

      logger.debug(`Processing user input for call ${callId}: ${userInput}`);

      // Add user input to conversation history
      callData.conversationHistory.push({
        role: 'user',
        content: userInput,
        timestamp: new Date()
      });

      // Get AI response
      const conversationState = await aiService.processResponse(callId, userInput);

      // Add AI response to conversation history
      callData.conversationHistory.push({
        role: 'assistant',
        content: conversationState.response,
        timestamp: new Date()
      });

      // Update call data
      callData.currentStage = conversationState.stage;
      callData.lastActivity = new Date();

      // Emit user input processed event
      this.emit('userInputProcessed', {
        callId: callId,
        userInput: userInput,
        aiResponse: conversationState.response,
        stage: conversationState.stage,
        intent: conversationState.intent
      });

      return {
        text: conversationState.response,
        shouldContinue: conversationState.shouldContinue,
        stage: conversationState.stage,
        intent: conversationState.intent
      };
    } catch (error) {
      logger.error(`Error processing user input for call ${callId}: ${error.message}`);
      
      // Return fallback response
      return {
        text: "I apologize, could you please repeat that?",
        shouldContinue: true,
        stage: 'error_recovery'
      };
    }
  }

  /**
   * Play next response in the conversation
   * @param {string} callId - Call UUID
   * @param {string} text - Text to convert to speech and play
   * @returns {Promise<string>} - Path to generated audio file
   */
  async playNextResponse(callId, text) {
    try {
      const callData = this.activeCalls.get(callId);
      if (!callData) {
        throw new Error(`No call data found for ${callId}`);
      }

      logger.debug(`Generating speech for call ${callId}: ${text.substring(0, 50)}...`);

      // Generate speech using TTS service
      const audioPath = await ttsService.generateSpeech(text, callData.voice.voiceId);

      // Update voice usage
      const duration = await require('../utils/audioProcessor').getDuration(audioPath);
      await callData.voice.updateUsage(duration / 60); // Convert to minutes

      // Emit speech generated event
      this.emit('speechGenerated', {
        callId: callId,
        text: text,
        audioPath: audioPath,
        duration: duration
      });

      return audioPath;
    } catch (error) {
      logger.error(`Error generating speech for call ${callId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * End call gracefully
   * @param {string} callId - Call UUID
   * @param {string} reason - Reason for ending the call
   * @returns {Promise<object>} - Call summary
   */
  async endCallGracefully(callId, reason = 'completed') {
    try {
      const callData = this.activeCalls.get(callId);
      if (!callData) {
        logger.warn(`No call data found for ${callId} during graceful end`);
        return null;
      }

      logger.info(`Ending call gracefully: ${callId}, reason: ${reason}`);

      // Get conversation summary from AI service
      const callSummary = aiService.endConversation(callId);

      // Calculate call duration
      const duration = (new Date() - callData.startTime) / 1000;

      // Update call data
      callData.status = 'ended';
      callData.endTime = new Date();
      callData.duration = duration;
      callData.endReason = reason;
      callData.summary = callSummary;

      // Update campaign statistics
      await this.updateCampaignStats(callData.campaignId, {
        calledLeads: 1,
        duration: duration
      });

      // Emit call ended event
      this.emit('callEnded', {
        callId: callId,
        lead: callData.lead,
        campaign: callData.campaign,
        duration: duration,
        reason: reason,
        summary: callSummary
      });

      // Clean up
      this.activeCalls.delete(callId);
      this.callLeadMapping.delete(callId);
      this.callCampaignMapping.delete(callId);

      return {
        callId: callId,
        duration: duration,
        reason: reason,
        summary: callSummary,
        transcript: callData.conversationHistory
          .map(msg => `${msg.role}: ${msg.content}`)
          .join('\n'),
        recording: callData.recording || null,
        sentiment: callSummary?.sentiment || 'neutral',
        outcome: this.determineCallOutcome(callSummary, reason),
        keyInsights: callSummary?.keyInsights || [],
        nextSteps: callSummary?.nextSteps || null,
        notes: callSummary?.notes || ''
      };
    } catch (error) {
      logger.error(`Error ending call gracefully ${callId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save call recording information
   * @param {string} callId - Call UUID
   * @param {object} recordingData - Recording data
   * @returns {Promise<void>}
   */
  async saveCallRecording(callId, recordingData) {
    try {
      const callData = this.activeCalls.get(callId);
      if (callData) {
        callData.recording = recordingData.url;
        callData.recordingDuration = recordingData.duration;
      }

      // Emit recording saved event
      this.emit('recordingSaved', {
        callId: callId,
        recordingUrl: recordingData.url,
        duration: recordingData.duration
      });

      logger.info(`Recording saved for call ${callId}: ${recordingData.url}`);
    } catch (error) {
      logger.error(`Error saving recording for call ${callId}: ${error.message}`);
    }
  }

  /**
   * Update call status
   * @param {string} callId - Call UUID
   * @param {string} status - New status
   * @param {object} metadata - Additional metadata
   * @returns {Promise<void>}
   */
  async updateCallStatus(callId, status, metadata = {}) {
    try {
      const callData = this.activeCalls.get(callId);
      if (callData) {
        callData.status = status;
        callData.lastActivity = new Date();
        
        if (metadata) {
          Object.assign(callData, metadata);
        }
      }

      // Emit status updated event
      this.emit('statusUpdated', {
        callId: callId,
        status: status,
        metadata: metadata
      });

      logger.debug(`Call status updated for ${callId}: ${status}`);
    } catch (error) {
      logger.error(`Error updating call status for ${callId}: ${error.message}`);
    }
  }

  /**
   * Handle call events from webhooks
   * @param {string} callId - Call UUID
   * @param {object} event - Call event
   * @returns {Promise<void>}
   */
  async handleCallEvent(callId, event) {
    try {
      const callData = this.activeCalls.get(callId);
      if (!callData) {
        logger.warn(`No call data found for event ${event.type} on call ${callId}`);
        return;
      }

      // Update call data based on event
      switch (event.type) {
        case 'StartApp':
          await this.updateCallStatus(callId, 'answered');
          break;
        
        case 'Speak':
          await this.updateCallStatus(callId, 'speaking');
          break;
        
        case 'Record':
          await this.updateCallStatus(callId, 'recording');
          break;
        
        case 'Hangup':
          await this.endCallGracefully(callId, event.data.HangupCause);
          break;
        
        default:
          logger.debug(`Unhandled event type: ${event.type} for call ${callId}`);
      }

      // Emit generic call event
      this.emit('callEvent', {
        callId: callId,
        event: event,
        callData: callData
      });
    } catch (error) {
      logger.error(`Error handling call event for ${callId}: ${error.message}`);
    }
  }

  /**
   * Get voicemail message for a call
   * @param {string} callId - Call UUID
   * @returns {Promise<string>} - Voicemail message
   */
  async getVoicemailMessage(callId) {
    try {
      const callData = this.activeCalls.get(callId);
      if (!callData) {
        return "Hello, this is an automated message. Please call back during business hours.";
      }

      const script = callData.script;
      return script.closingStatements?.voicemail || 
             "Hello, this is an automated message. We'll try calling back at a better time. Thank you.";
    } catch (error) {
      logger.error(`Error getting voicemail message for ${callId}: ${error.message}`);
      return "Hello, this is an automated message. Please call back during business hours.";
    }
  }

  /**
   * Get lead by call ID
   * @param {string} callId - Call UUID
   * @returns {object|null} - Lead object or null
   */
  getLeadByCallId(callId) {
    return this.callLeadMapping.get(callId) || null;
  }

  /**
   * Get campaign by call ID
   * @param {string} callId - Call UUID
   * @returns {object|null} - Campaign object or null
   */
  getCampaignByCallId(callId) {
    return this.callCampaignMapping.get(callId) || null;
  }

  /**
   * Get active calls count
   * @returns {number} - Number of active calls
   */
  getActiveCallsCount() {
    return this.activeCalls.size;
  }

  /**
   * Get all active calls
   * @returns {Array} - Array of active call data
   */
  getActiveCalls() {
    return Array.from(this.activeCalls.values());
  }

  /**
   * Force end a call
   * @param {string} callId - Call UUID
   * @returns {Promise<object>} - End call result
   */
  async forceEndCall(callId) {
    try {
      // End the call through Plivo
      await callingService.endCall(callId);
      
      // End gracefully in orchestrator
      return await this.endCallGracefully(callId, 'force_ended');
    } catch (error) {
      logger.error(`Error force ending call ${callId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update campaign statistics
   * @param {string} campaignId - Campaign ID
   * @param {object} stats - Statistics to update
   * @private
   */
  async updateCampaignStats(campaignId, stats) {
    try {
      const updateData = {};
      
      if (stats.calledLeads) {
        updateData.$inc = { calledLeads: stats.calledLeads };
      }
      
      await Campaign.findByIdAndUpdate(campaignId, updateData);
    } catch (error) {
      logger.error(`Error updating campaign stats: ${error.message}`);
    }
  }

  /**
   * Determine call outcome based on summary and reason
   * @param {object} summary - Call summary
   * @param {string} reason - End reason
   * @returns {string} - Call outcome
   * @private
   */
  determineCallOutcome(summary, reason) {
    if (reason === 'NORMAL_CLEARING' && summary) {
      if (summary.sentiment === 'positive') {
        return 'connected';
      } else if (summary.sentiment === 'negative') {
        return 'connected';
      }
      return 'connected';
    }
    
    const outcomeMap = {
      'USER_BUSY': 'busy',
      'NO_ANSWER': 'no-answer',
      'CALL_REJECTED': 'failed',
      'INVALID_NUMBER_FORMAT': 'wrong-number',
      'force_ended': 'failed'
    };
    
    return outcomeMap[reason] || 'failed';
  }
}

module.exports = new CallOrchestrator();
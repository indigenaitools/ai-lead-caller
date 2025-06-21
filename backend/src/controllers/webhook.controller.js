const plivo = require('plivo');
const logger = require('../utils/logger');
const callingService = require('../services/calling.service');
const callOrchestrator = require('../services/callOrchestrator');
const CallLog = require('../models/CallLog');
const Lead = require('../models/Lead');

/**
 * Webhook controller for handling Plivo webhook events
 */
class WebhookController {
  /**
   * Handle Plivo answer webhook - called when call is answered
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  static async handleAnswer(req, res) {
    try {
      const {
        CallUUID,
        From,
        To,
        Direction,
        CallStatus,
        Machine
      } = req.body;

      logger.info(`Call answered - UUID: ${CallUUID}, From: ${From}, To: ${To}`);

      // Create Plivo XML response
      const response = new plivo.Response();

      // Check if it's a machine/voicemail
      if (Machine === 'true') {
        logger.info(`Machine detected for call ${CallUUID}`);
        
        // Play voicemail message
        const voicemailMessage = await callOrchestrator.getVoicemailMessage(CallUUID);
        response.addSpeak(voicemailMessage, {
          voice: 'WOMAN',
          language: 'en-US'
        });
        
        // Hang up after voicemail
        response.addHangup();
      } else {
        logger.info(`Human answered call ${CallUUID}`);
        
        // Start the conversation
        const initialMessage = await callOrchestrator.startConversation(CallUUID);
        
        if (initialMessage) {
          // Play the initial message
          response.addSpeak(initialMessage, {
            voice: 'WOMAN',
            language: 'en-US'
          });
          
          // Wait for user input
          response.addGetInput({
            action: `${process.env.BASE_URL}/webhooks/plivo/input`,
            method: 'POST',
            inputType: 'speech',
            speechModel: 'default',
            speechEndTimeout: 3,
            maxSpeechDuration: 30,
            finishOnKey: '#'
          });
        } else {
          // Fallback message if conversation can't start
          response.addSpeak('Thank you for your time. Have a great day!', {
            voice: 'WOMAN',
            language: 'en-US'
          });
          response.addHangup();
        }
      }

      // Update call status in orchestrator
      await callOrchestrator.updateCallStatus(CallUUID, 'answered', {
        from: From,
        to: To,
        direction: Direction,
        machine: Machine === 'true'
      });

      res.set('Content-Type', 'text/xml');
      res.send(response.toXML());
    } catch (error) {
      logger.error(`Error handling answer webhook: ${error.message}`);
      
      // Return error response
      const errorResponse = new plivo.Response();
      errorResponse.addSpeak('We apologize, but there was a technical issue. Please try again later.');
      errorResponse.addHangup();
      
      res.set('Content-Type', 'text/xml');
      res.send(errorResponse.toXML());
    }
  }

  /**
   * Handle user input from speech recognition
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  static async handleInput(req, res) {
    try {
      const {
        CallUUID,
        Speech,
        InputType,
        Digits
      } = req.body;

      logger.info(`Received input for call ${CallUUID}: ${Speech || Digits}`);

      const response = new plivo.Response();
      
      // Process the user input
      const userInput = Speech || Digits || '';
      const aiResponse = await callOrchestrator.processUserInput(CallUUID, userInput);

      if (aiResponse && aiResponse.shouldContinue) {
        // Play AI response
        response.addSpeak(aiResponse.text, {
          voice: 'WOMAN',
          language: 'en-US'
        });

        // Continue listening for input if conversation should continue
        response.addGetInput({
          action: `${process.env.BASE_URL}/webhooks/plivo/input`,
          method: 'POST',
          inputType: 'speech',
          speechModel: 'default',
          speechEndTimeout: 3,
          maxSpeechDuration: 30,
          finishOnKey: '#'
        });
      } else {
        // End the conversation
        const closingMessage = aiResponse?.text || 'Thank you for your time. Have a great day!';
        response.addSpeak(closingMessage, {
          voice: 'WOMAN',
          language: 'en-US'
        });
        response.addHangup();
        
        // End the call in orchestrator
        await callOrchestrator.endCall(CallUUID, 'conversation_completed');
      }

      res.set('Content-Type', 'text/xml');
      res.send(response.toXML());
    } catch (error) {
      logger.error(`Error handling input webhook: ${error.message}`);
      
      // Return error response
      const errorResponse = new plivo.Response();
      errorResponse.addSpeak('I apologize, but I didn\'t catch that. Could you please repeat?');
      errorResponse.addGetInput({
        action: `${process.env.BASE_URL}/webhooks/plivo/input`,
        method: 'POST',
        inputType: 'speech',
        speechModel: 'default',
        speechEndTimeout: 3,
        maxSpeechDuration: 30,
        finishOnKey: '#'
      });
      
      res.set('Content-Type', 'text/xml');
      res.send(errorResponse.toXML());
    }
  }

  /**
   * Handle call hangup events
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  static async handleHangup(req, res) {
    try {
      const {
        CallUUID,
        HangupCause,
        Duration,
        BillDuration,
        TotalCost,
        From,
        To
      } = req.body;

      logger.info(`Call ended - UUID: ${CallUUID}, Cause: ${HangupCause}, Duration: ${Duration}s`);

      // Process the webhook event
      const event = callingService.handleWebhook(req.body);

      // End the call in orchestrator and get summary
      const callSummary = await callOrchestrator.endCall(CallUUID, HangupCause);

      // Save call log to database
      await this.saveCallLog(CallUUID, {
        duration: parseInt(Duration) || 0,
        billDuration: parseInt(BillDuration) || 0,
        cost: parseFloat(TotalCost) || 0,
        hangupCause: HangupCause,
        from: From,
        to: To,
        summary: callSummary
      });

      res.status(200).json({ status: 'success', message: 'Hangup processed' });
    } catch (error) {
      logger.error(`Error handling hangup webhook: ${error.message}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle machine detection events
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  static async handleMachine(req, res) {
    try {
      const {
        CallUUID,
        Machine
      } = req.body;

      logger.info(`Machine detection result for call ${CallUUID}: ${Machine}`);

      const response = new plivo.Response();

      if (Machine === 'true') {
        // It's a machine/voicemail
        const voicemailMessage = await callOrchestrator.getVoicemailMessage(CallUUID);
        response.addSpeak(voicemailMessage, {
          voice: 'WOMAN',
          language: 'en-US'
        });
        response.addHangup();
        
        // Update call status
        await callOrchestrator.updateCallStatus(CallUUID, 'voicemail');
      } else {
        // It's a human, continue with normal flow
        response.addContinue();
      }

      res.set('Content-Type', 'text/xml');
      res.send(response.toXML());
    } catch (error) {
      logger.error(`Error handling machine detection webhook: ${error.message}`);
      
      const errorResponse = new plivo.Response();
      errorResponse.addHangup();
      
      res.set('Content-Type', 'text/xml');
      res.send(errorResponse.toXML());
    }
  }

  /**
   * Handle call recording events
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  static async handleRecording(req, res) {
    try {
      const {
        CallUUID,
        RecordUrl,
        Duration,
        RecordingID,
        RecordingDuration,
        RecordingDurationMs,
        RecordingStartMs,
        RecordingEndMs
      } = req.body;

      logger.info(`Recording available for call ${CallUUID}: ${RecordUrl}`);

      // Save recording information
      await callOrchestrator.saveCallRecording(CallUUID, {
        url: RecordUrl,
        duration: parseInt(RecordingDuration) || parseInt(Duration) || 0,
        recordingId: RecordingID,
        durationMs: parseInt(RecordingDurationMs) || 0,
        startMs: parseInt(RecordingStartMs) || 0,
        endMs: parseInt(RecordingEndMs) || 0
      });

      // Update the call log with recording information
      await this.updateCallLogWithRecording(CallUUID, RecordUrl, parseInt(RecordingDuration) || 0);

      res.status(200).json({ status: 'success', message: 'Recording processed' });
    } catch (error) {
      logger.error(`Error handling recording webhook: ${error.message}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle general callback events
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  static async handleCallback(req, res) {
    try {
      const event = req.body;
      const eventType = event.Event || event.event;
      const callId = event.CallUUID || event.call_uuid;

      logger.info(`Received callback event: ${eventType} for call: ${callId}`);

      // Process the webhook event
      const processedEvent = callingService.handleWebhook(event);

      // Notify orchestrator of the event
      await callOrchestrator.handleCallEvent(callId, processedEvent);

      res.status(200).json({ 
        status: 'success', 
        message: 'Callback processed',
        event: processedEvent.type
      });
    } catch (error) {
      logger.error(`Error handling callback webhook: ${error.message}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Save call log to database
   * @param {string} callId - Call UUID
   * @param {object} callData - Call data to save
   * @private
   */
  static async saveCallLog(callId, callData) {
    try {
      // Find the lead associated with this call
      const lead = await callOrchestrator.getLeadByCallId(callId);
      
      if (!lead) {
        logger.warn(`No lead found for call ${callId}`);
        return;
      }

      // Create call log entry
      const callLog = new CallLog({
        leadId: lead._id,
        duration: callData.duration,
        cost: Math.round(callData.cost * 100), // Convert to cents
        recording: callData.summary?.recording || null,
        transcript: callData.summary?.transcript || '',
        sentiment: callData.summary?.sentiment || 'neutral',
        outcome: this.mapHangupCauseToOutcome(callData.hangupCause),
        notes: callData.summary?.notes || '',
        keyInsights: callData.summary?.keyInsights || [],
        nextSteps: callData.summary?.nextSteps || null
      });

      await callLog.save();

      // Update lead with call information
      await Lead.findByIdAndUpdate(lead._id, {
        status: this.mapOutcomeToLeadStatus(callLog.outcome),
        callDuration: callData.duration,
        calledAt: new Date(),
        callRecording: callData.summary?.recording || null,
        transcript: callData.summary?.transcript || ''
      });

      logger.info(`Call log saved for call ${callId}`);
    } catch (error) {
      logger.error(`Error saving call log for ${callId}: ${error.message}`);
    }
  }

  /**
   * Update call log with recording information
   * @param {string} callId - Call UUID
   * @param {string} recordingUrl - Recording URL
   * @param {number} duration - Recording duration
   * @private
   */
  static async updateCallLogWithRecording(callId, recordingUrl, duration) {
    try {
      const lead = await callOrchestrator.getLeadByCallId(callId);
      
      if (!lead) {
        logger.warn(`No lead found for call ${callId} recording update`);
        return;
      }

      // Update call log with recording
      await CallLog.findOneAndUpdate(
        { leadId: lead._id },
        { 
          recording: recordingUrl,
          $set: { 'duration': Math.max(duration, 0) }
        },
        { sort: { createdAt: -1 } } // Get the most recent call log
      );

      // Update lead with recording
      await Lead.findByIdAndUpdate(lead._id, {
        callRecording: recordingUrl
      });

      logger.info(`Recording updated for call ${callId}`);
    } catch (error) {
      logger.error(`Error updating recording for ${callId}: ${error.message}`);
    }
  }

  /**
   * Map Plivo hangup cause to call outcome
   * @param {string} hangupCause - Plivo hangup cause
   * @returns {string} - Mapped outcome
   * @private
   */
  static mapHangupCauseToOutcome(hangupCause) {
    const outcomeMap = {
      'NORMAL_CLEARING': 'connected',
      'USER_BUSY': 'busy',
      'NO_ANSWER': 'no-answer',
      'CALL_REJECTED': 'failed',
      'INVALID_NUMBER_FORMAT': 'wrong-number',
      'NETWORK_OUT_OF_ORDER': 'failed',
      'NORMAL_TEMPORARY_FAILURE': 'failed',
      'USER_NOT_RESPONDING': 'no-answer',
      'NO_USER_RESPONSE': 'no-answer',
      'SUBSCRIBER_ABSENT': 'no-answer',
      'CALL_ABANDONED': 'no-answer'
    };

    return outcomeMap[hangupCause] || 'failed';
  }

  /**
   * Map call outcome to lead status
   * @param {string} outcome - Call outcome
   * @returns {string} - Lead status
   * @private
   */
  static mapOutcomeToLeadStatus(outcome) {
    const statusMap = {
      'connected': 'called',
      'no-answer': 'new',
      'voicemail': 'called',
      'busy': 'new',
      'failed': 'new',
      'wrong-number': 'not-interested'
    };

    return statusMap[outcome] || 'new';
  }

  /**
   * Validate Plivo webhook signature (for security)
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @param {function} next - Next middleware function
   */
  static validateWebhookSignature(req, res, next) {
    try {
      const signature = req.headers['x-plivo-signature-v2'];
      const authToken = process.env.PLIVO_AUTH_TOKEN;
      
      if (!signature || !authToken) {
        logger.warn('Missing webhook signature or auth token');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Verify the signature
      const isValid = plivo.validateSignature(
        req.originalUrl,
        req.body,
        signature,
        authToken
      );

      if (!isValid) {
        logger.warn('Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      next();
    } catch (error) {
      logger.error(`Error validating webhook signature: ${error.message}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = WebhookController;
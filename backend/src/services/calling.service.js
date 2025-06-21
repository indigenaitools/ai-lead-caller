const plivo = require('plivo');
const logger = require('../utils/logger');

/**
 * Plivo client for making and managing phone calls
 */
class PlivoClient {
  constructor() {
    this.client = null;
    this.authId = process.env.PLIVO_AUTH_ID || '';
    this.authToken = process.env.PLIVO_AUTH_TOKEN || '';
    this.initialized = false;
  }

  /**
   * Initialize the Plivo client with authentication credentials
   * @param {string} authId - Plivo Auth ID
   * @param {string} authToken - Plivo Auth Token
   */
  initialize(authId = null, authToken = null) {
    this.authId = authId || this.authId;
    this.authToken = authToken || this.authToken;

    if (!this.authId || !this.authToken) {
      throw new Error('Plivo Auth ID and Auth Token are required');
    }

    this.client = new plivo.Client(this.authId, this.authToken);
    this.initialized = true;
    
    logger.info('Plivo client initialized successfully');
  }

  /**
   * Ensure the client is initialized
   * @private
   */
  ensureInitialized() {
    if (!this.initialized || !this.client) {
      throw new Error('Plivo client not initialized. Call initialize() first.');
    }
  }

  /**
   * Purchase a phone number from Plivo
   * @param {string} areaCode - Area code for the phone number
   * @param {string} country - Country code (default: US)
   * @returns {Promise<object>} - Purchased phone number details
   */
  async purchasePhoneNumber(areaCode, country = 'US') {
    this.ensureInitialized();

    try {
      logger.info(`Searching for available phone numbers in area code: ${areaCode}`);

      // Search for available phone numbers
      const searchResponse = await this.client.numbers.search(country, {
        pattern: `${areaCode}%`,
        type: 'local',
        limit: 10
      });

      if (!searchResponse.objects || searchResponse.objects.length === 0) {
        throw new Error(`No phone numbers available in area code ${areaCode}`);
      }

      // Purchase the first available number
      const phoneNumber = searchResponse.objects[0].number;
      
      const purchaseResponse = await this.client.numbers.buy(phoneNumber, {
        app_id: process.env.PLIVO_APP_ID || null
      });

      logger.info(`Successfully purchased phone number: ${phoneNumber}`);

      return {
        number: phoneNumber,
        status: purchaseResponse.status,
        message: purchaseResponse.message,
        monthlyRental: searchResponse.objects[0].monthly_rental_rate,
        setupCost: searchResponse.objects[0].setup_rate
      };
    } catch (error) {
      logger.error(`Error purchasing phone number: ${error.message}`);
      throw error;
    }
  }

  /**
   * Make a phone call using Plivo
   * @param {string} to - Destination phone number
   * @param {string} from - Source phone number (must be owned by account)
   * @param {string} webhookUrl - Webhook URL for call events
   * @param {object} options - Additional call options
   * @returns {Promise<object>} - Call details
   */
  async makeCall(to, from, webhookUrl, options = {}) {
    this.ensureInitialized();

    try {
      // Clean phone numbers (remove any formatting)
      const cleanTo = to.replace(/\D/g, '');
      const cleanFrom = from.replace(/\D/g, '');

      // Add country code if not present
      const formattedTo = cleanTo.startsWith('1') ? cleanTo : `1${cleanTo}`;
      const formattedFrom = cleanFrom.startsWith('1') ? cleanFrom : `1${cleanFrom}`;

      logger.info(`Initiating call from ${formattedFrom} to ${formattedTo}`);

      const callParams = {
        to: formattedTo,
        from: formattedFrom,
        answer_url: `${webhookUrl}/answer`,
        answer_method: 'POST',
        hangup_url: `${webhookUrl}/hangup`,
        hangup_method: 'POST',
        machine_detection: 'true',
        machine_detection_time: 5000,
        machine_detection_url: `${webhookUrl}/machine`,
        machine_detection_method: 'POST',
        record: 'true',
        record_callback_url: `${webhookUrl}/recording`,
        record_callback_method: 'POST',
        time_limit: 1800, // 30 minutes max
        timeout: 30, // Ring timeout
        caller_name: options.callerName || 'AI Assistant',
        ...options
      };

      const response = await this.client.calls.create(callParams);

      logger.info(`Call initiated successfully. Call UUID: ${response.callUuid}`);

      return {
        callId: response.callUuid,
        status: 'initiated',
        to: formattedTo,
        from: formattedFrom,
        message: response.message
      };
    } catch (error) {
      logger.error(`Error making call: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle incoming webhook events from Plivo
   * @param {object} event - Webhook event data
   * @returns {object} - Processed event information
   */
  handleWebhook(event) {
    try {
      const eventType = event.Event || event.event;
      const callId = event.CallUUID || event.call_uuid;

      logger.debug(`Received webhook event: ${eventType} for call: ${callId}`);

      const processedEvent = {
        type: eventType,
        callId: callId,
        timestamp: new Date(),
        data: event
      };

      switch (eventType) {
        case 'StartApp':
          processedEvent.status = 'answered';
          processedEvent.direction = event.Direction;
          break;

        case 'Speak':
          processedEvent.status = 'speaking';
          processedEvent.duration = event.Duration;
          break;

        case 'Record':
          processedEvent.status = 'recording';
          processedEvent.recordingUrl = event.RecordUrl;
          processedEvent.duration = event.Duration;
          break;

        case 'Hangup':
          processedEvent.status = 'ended';
          processedEvent.hangupCause = event.HangupCause;
          processedEvent.duration = event.Duration;
          processedEvent.billDuration = event.BillDuration;
          processedEvent.totalCost = event.TotalCost;
          break;

        case 'MachineDetection':
          processedEvent.status = 'machine_detected';
          processedEvent.machine = event.Machine === 'true';
          break;

        default:
          processedEvent.status = 'unknown';
          logger.warn(`Unknown webhook event type: ${eventType}`);
      }

      return processedEvent;
    } catch (error) {
      logger.error(`Error handling webhook: ${error.message}`);
      throw error;
    }
  }

  /**
   * End an active call
   * @param {string} callId - Call UUID to end
   * @returns {Promise<object>} - End call response
   */
  async endCall(callId) {
    this.ensureInitialized();

    try {
      logger.info(`Ending call: ${callId}`);

      const response = await this.client.calls.hangup(callId);

      logger.info(`Call ended successfully: ${callId}`);

      return {
        callId: callId,
        status: 'ended',
        message: response.message
      };
    } catch (error) {
      logger.error(`Error ending call ${callId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get details of a specific call
   * @param {string} callId - Call UUID
   * @returns {Promise<object>} - Call details
   */
  async getCallDetails(callId) {
    this.ensureInitialized();

    try {
      logger.debug(`Fetching call details for: ${callId}`);

      const response = await this.client.calls.get(callId);

      return {
        callId: response.callUuid,
        from: response.fromNumber,
        to: response.toNumber,
        direction: response.callDirection,
        status: response.callState,
        startTime: response.startTime,
        endTime: response.endTime,
        duration: response.duration,
        billDuration: response.billDuration,
        totalAmount: response.totalAmount,
        totalRate: response.totalRate,
        parentCallUuid: response.parentCallUuid,
        hangupCause: response.hangupCause,
        hangupSource: response.hangupSource
      };
    } catch (error) {
      logger.error(`Error fetching call details for ${callId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get call recordings
   * @param {string} callId - Call UUID
   * @returns {Promise<Array>} - Array of recording details
   */
  async getCallRecordings(callId) {
    this.ensureInitialized();

    try {
      logger.debug(`Fetching recordings for call: ${callId}`);

      const response = await this.client.recordings.list({
        call_uuid: callId
      });

      return response.objects.map(recording => ({
        recordingId: recording.recordingId,
        callId: recording.callUuid,
        url: recording.recordingUrl,
        duration: recording.recordingDuration,
        format: recording.recordingFormat,
        startTime: recording.addTime
      }));
    } catch (error) {
      logger.error(`Error fetching recordings for call ${callId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send DTMF digits during a call
   * @param {string} callId - Call UUID
   * @param {string} digits - DTMF digits to send
   * @returns {Promise<object>} - DTMF response
   */
  async sendDTMF(callId, digits) {
    this.ensureInitialized();

    try {
      logger.debug(`Sending DTMF ${digits} to call: ${callId}`);

      const response = await this.client.calls.sendDigits(callId, {
        digits: digits
      });

      return {
        callId: callId,
        digits: digits,
        status: 'sent',
        message: response.message
      };
    } catch (error) {
      logger.error(`Error sending DTMF to call ${callId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Transfer a call to another number
   * @param {string} callId - Call UUID to transfer
   * @param {string} to - Number to transfer to
   * @param {object} options - Transfer options
   * @returns {Promise<object>} - Transfer response
   */
  async transferCall(callId, to, options = {}) {
    this.ensureInitialized();

    try {
      const cleanTo = to.replace(/\D/g, '');
      const formattedTo = cleanTo.startsWith('1') ? cleanTo : `1${cleanTo}`;

      logger.info(`Transferring call ${callId} to ${formattedTo}`);

      const transferParams = {
        legs: 'aleg',
        aleg_url: options.webhookUrl || `${process.env.BASE_URL}/webhooks/plivo/transfer`,
        aleg_method: 'POST',
        ...options
      };

      const response = await this.client.calls.transfer(callId, transferParams);

      return {
        callId: callId,
        transferTo: formattedTo,
        status: 'transferred',
        message: response.message
      };
    } catch (error) {
      logger.error(`Error transferring call ${callId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get account balance and pricing information
   * @returns {Promise<object>} - Account information
   */
  async getAccountInfo() {
    this.ensureInitialized();

    try {
      const account = await this.client.account.get();
      const pricing = await this.client.pricing.get({ country_iso: 'US' });

      return {
        balance: account.cashCredits,
        currency: account.currency,
        autoRecharge: account.autoRecharge,
        pricingUS: pricing.outboundSmsRate,
        callRateUS: pricing.outboundCallRate
      };
    } catch (error) {
      logger.error(`Error fetching account info: ${error.message}`);
      throw error;
    }
  }

  /**
   * List owned phone numbers
   * @returns {Promise<Array>} - Array of owned phone numbers
   */
  async getOwnedNumbers() {
    this.ensureInitialized();

    try {
      const response = await this.client.numbers.list();

      return response.objects.map(number => ({
        number: number.number,
        type: number.numberType,
        country: number.country,
        region: number.region,
        monthlyRental: number.monthlyRentalRate,
        application: number.application
      }));
    } catch (error) {
      logger.error(`Error fetching owned numbers: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Main calling service class
 */
class CallingService {
  constructor() {
    this.plivoClient = new PlivoClient();
    this.activeCalls = new Map();
  }

  /**
   * Initialize the calling service
   * @param {string} authId - Plivo Auth ID
   * @param {string} authToken - Plivo Auth Token
   */
  initialize(authId, authToken) {
    this.plivoClient.initialize(authId, authToken);
  }

  /**
   * Make a call through the service
   * @param {string} to - Destination number
   * @param {string} from - Source number
   * @param {string} webhookUrl - Webhook URL
   * @param {object} options - Call options
   * @returns {Promise<object>} - Call result
   */
  async makeCall(to, from, webhookUrl, options = {}) {
    const result = await this.plivoClient.makeCall(to, from, webhookUrl, options);
    
    // Track the active call
    this.activeCalls.set(result.callId, {
      ...result,
      startTime: new Date(),
      status: 'initiated'
    });

    return result;
  }

  /**
   * Handle webhook events
   * @param {object} event - Webhook event
   * @returns {object} - Processed event
   */
  handleWebhook(event) {
    const processedEvent = this.plivoClient.handleWebhook(event);
    
    // Update active call status
    if (this.activeCalls.has(processedEvent.callId)) {
      const call = this.activeCalls.get(processedEvent.callId);
      call.status = processedEvent.status;
      call.lastEvent = processedEvent;
      
      // Remove from active calls if ended
      if (processedEvent.status === 'ended') {
        this.activeCalls.delete(processedEvent.callId);
      }
    }

    return processedEvent;
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
   * @returns {Array} - Array of active call objects
   */
  getActiveCalls() {
    return Array.from(this.activeCalls.values());
  }

  /**
   * End a call
   * @param {string} callId - Call ID to end
   * @returns {Promise<object>} - End call result
   */
  async endCall(callId) {
    const result = await this.plivoClient.endCall(callId);
    
    // Remove from active calls
    this.activeCalls.delete(callId);
    
    return result;
  }

  /**
   * Get call details
   * @param {string} callId - Call ID
   * @returns {Promise<object>} - Call details
   */
  async getCallDetails(callId) {
    return await this.plivoClient.getCallDetails(callId);
  }
}

module.exports = new CallingService();